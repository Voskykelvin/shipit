import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import {
  createReturnSchema,
  inspectReturnSchema,
  receiveReturnSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';
import { enqueueDomainEvent } from './jobs.js';

const returnsRouter = Router();

class ReturnRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendReturnError(error: unknown, res: Response) {
  if (error instanceof ReturnRequestError) return res.status(error.status).json({ error: error.message });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Return or inventory changed concurrently; retry the operation' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    return res.status(409).json({ error: 'A return already exists for this order or product' });
  }
  console.error('Return database operation failed', error);
  return res.status(503).json({ error: 'Returns service unavailable' });
}

function newReturnNumber() {
  return `RTN-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

const returnInclude = {
  items: {
    include: {
      product: { select: { id: true, sku: true, name: true, barcode: true } },
      location: true,
      inspections: { orderBy: { inspectedAt: 'asc' as const } },
    },
  },
  order: { select: { id: true, orderNumber: true, status: true } },
};

function enqueueReturnEvent(type: string, record: { id: string; merchantId: string; orderId: string }, userId: string) {
  void enqueueDomainEvent({
    type,
    entityId: record.id,
    merchantId: record.merchantId,
    actorUserId: userId,
    payload: { orderId: record.orderId },
  }).catch((error: unknown) => console.error('Could not enqueue return event', error));
}

returnsRouter.get('/returns', async (req: Request, res: Response) => {
  try {
    const records = await prisma.returnRecord.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      include: returnInclude,
      orderBy: { initiatedAt: 'desc' },
      take: 500,
    });
    return res.json(records);
  } catch (error) {
    return sendReturnError(error, res);
  }
});

returnsRouter.get('/returns/:id', async (req: Request, res: Response) => {
  try {
    const record = await prisma.returnRecord.findUnique({ where: { id: req.params.id }, include: returnInclude });
    if (!record || !canAccessMerchant(req, record.merchantId)) return res.status(404).json({ error: 'Return not found' });
    return res.json(record);
  } catch (error) {
    return sendReturnError(error, res);
  }
});

returnsRouter.post('/returns', async (req: Request, res: Response) => {
  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const record = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findFirst({
        where: { OR: [{ id: parsed.data.orderId }, { orderNumber: parsed.data.orderId }] },
        include: { items: true, returns: { include: { items: true } } },
      });
      if (!order || !canAccessMerchant(req, order.merchantId)) throw new ReturnRequestError(404, 'Order not found');
      if (order.returns.some((record) => record.status !== 'INSPECTED')) {
        throw new ReturnRequestError(409, 'This order already has an active return');
      }

      const immediateRto = parsed.data.returnType === 'IMMEDIATE_RTO';
      if (immediateRto && order.status !== 'RETURN_IN_TRANSIT') {
        throw new ReturnRequestError(409, 'An immediate RTO can only be recorded after NDR resolution');
      }
      if (!immediateRto && order.status !== 'DELIVERED') {
        throw new ReturnRequestError(409, 'Customer returns can only be initiated for delivered orders');
      }

      for (const item of parsed.data.items) {
        const orderedUnits = order.items.filter((line) => line.productId === item.productId)
          .reduce((sum, line) => sum + line.quantity, 0);
        const previouslyReturnedUnits = order.returns.flatMap((record) => record.items)
          .filter((returnedItem) => returnedItem.productId === item.productId)
          .reduce((sum, returnedItem) => sum + returnedItem.receivedUnits, 0);
        if (!orderedUnits || item.quantity + previouslyReturnedUnits > orderedUnits) {
          throw new ReturnRequestError(400, 'Return quantity exceeds the ordered quantity for a product');
        }
      }

      const created = await transaction.returnRecord.create({
        data: {
          returnNumber: newReturnNumber(),
          orderId: order.id,
          merchantId: order.merchantId,
          returnType: parsed.data.returnType,
          status: immediateRto ? 'IN_TRANSIT' : 'RETURN_INITIATED',
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          items: { create: parsed.data.items.map((item) => ({ productId: item.productId, expectedUnits: item.quantity })) },
        },
        include: returnInclude,
      });
      if (!immediateRto) {
        await transaction.order.update({ where: { id: order.id }, data: { status: 'RETURN_IN_TRANSIT' } });
      }
      return created;
    }, { isolationLevel: 'Serializable' });

    enqueueReturnEvent('return.initiated', record, req.auth!.userId);
    return res.status(201).json(record);
  } catch (error) {
    return sendReturnError(error, res);
  }
});

returnsRouter.post('/returns/:id/receive', async (req: Request, res: Response) => {
  const parsed = receiveReturnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const record = await prisma.$transaction(async (transaction) => {
      const current = await transaction.returnRecord.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!current || !canAccessMerchant(req, current.merchantId)) throw new ReturnRequestError(404, 'Return not found');
      if (!['RETURN_INITIATED', 'IN_TRANSIT'].includes(current.status)) {
        throw new ReturnRequestError(409, 'Return is not awaiting warehouse receipt');
      }
      if (parsed.data.items.length !== current.items.length) {
        throw new ReturnRequestError(400, 'A quarantine location is required for every return item');
      }

      for (const receipt of parsed.data.items) {
        const item = current.items.find((candidate) => candidate.productId === receipt.productId);
        if (!item) throw new ReturnRequestError(400, 'Receipt contains a product not listed on this return');
        if (receipt.receivedUnits > item.expectedUnits) {
          throw new ReturnRequestError(409, 'Received quantity exceeds the expected return quantity');
        }

        if (receipt.receivedUnits > 0) {
          const location = await transaction.warehouseLocation.findFirst({
            where: { id: receipt.locationId, zone: 'QUARANTINE', warehouse: { isActive: true } },
          });
          if (!location) throw new ReturnRequestError(400, 'Returns must be received into an active quarantine location');
          const key = { productId: item.productId, locationId: location.id };
          await transaction.inventoryLevel.upsert({
            where: { productId_locationId: key },
            create: { ...key, quarantineQty: receipt.receivedUnits },
            update: { quarantineQty: { increment: receipt.receivedUnits } },
          });
          await transaction.inventoryTransaction.create({
            data: {
              merchantId: current.merchantId,
              ...key,
              type: 'RETURN_QUARANTINE',
              referenceId: current.returnNumber,
              deltaQuarantine: receipt.receivedUnits,
              performedByUserId: req.auth!.userId,
              reasonCode: `Received ${receipt.receivedUnits} units for ${current.returnNumber}`,
            },
          });
          await transaction.warehouseLocation.update({ where: { id: location.id }, data: { isOccupied: true } });
        }
        await transaction.returnItem.update({
          where: { id: item.id },
          data: { receivedUnits: receipt.receivedUnits, locationId: receipt.locationId ?? null },
        });
      }

      return transaction.returnRecord.update({
        where: { id: current.id },
        data: { status: 'RECEIVED_AT_WAREHOUSE', receivedAt: new Date() },
        include: returnInclude,
      });
    }, { isolationLevel: 'Serializable' });

    enqueueReturnEvent('return.received', record, req.auth!.userId);
    return res.json({ success: true, return: record });
  } catch (error) {
    return sendReturnError(error, res);
  }
});

returnsRouter.post('/returns/:id/inspect', async (req: Request, res: Response) => {
  const parsed = inspectReturnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const current = await transaction.returnRecord.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!current || !canAccessMerchant(req, current.merchantId)) throw new ReturnRequestError(404, 'Return not found');
      if (current.status !== 'RECEIVED_AT_WAREHOUSE') throw new ReturnRequestError(409, 'Return must be received before inspection');
      if (parsed.data.items.length === 0 && current.items.some((item) => item.receivedUnits !== item.inspectedUnits)) {
        throw new ReturnRequestError(400, 'Inspection details are required for all physically received units');
      }

      const inspectedUnitsByItem = new Map(current.items.map((item) => [item.id, item.inspectedUnits]));
      for (const inspection of parsed.data.items) {
        const item = current.items.find((candidate) => candidate.productId === inspection.productId);
        if (!item || !item.locationId) throw new ReturnRequestError(400, 'Inspection contains a product not received on this return');
        const inspectedUnits = (inspectedUnitsByItem.get(item.id) ?? 0) + inspection.quantity;
        if (inspectedUnits > item.receivedUnits) throw new ReturnRequestError(409, 'Inspection quantity exceeds received units');

        const isGradeA = inspection.conditionGrade === 'GRADE_A_RESTOCKABLE';
        if (inspection.action === 'RESTOCKED_TO_AVAILABLE' && !isGradeA) {
          throw new ReturnRequestError(400, 'Only Grade A products can be restocked as available');
        }
        if (isGradeA && inspection.action === 'QUARANTINED') {
          throw new ReturnRequestError(400, 'Grade A products must be restocked or returned to the merchant');
        }

        await transaction.returnInspection.create({
          data: {
            returnItemId: item.id,
            inspectedByUserId: req.auth!.userId,
            quantity: inspection.quantity,
            conditionGrade: inspection.conditionGrade,
            action: inspection.action,
            photos: inspection.photos,
          },
        });

        if (inspection.action !== 'QUARANTINED') {
          const inventoryChange = await transaction.inventoryLevel.updateMany({
            where: {
              productId: item.productId,
              locationId: item.locationId,
              quarantineQty: { gte: inspection.quantity },
            },
            data: inspection.action === 'RESTOCKED_TO_AVAILABLE'
              ? { quarantineQty: { decrement: inspection.quantity }, availableQty: { increment: inspection.quantity } }
              : { quarantineQty: { decrement: inspection.quantity } },
          });
          if (inventoryChange.count !== 1) throw new ReturnRequestError(409, 'Quarantine stock changed; retry inspection');
          await transaction.inventoryTransaction.create({
            data: {
              merchantId: current.merchantId,
              productId: item.productId,
              locationId: item.locationId,
              type: inspection.action === 'RESTOCKED_TO_AVAILABLE' ? 'RETURN_RESTOCK' : 'RETURN_QUARANTINE',
              referenceId: current.returnNumber,
              deltaAvailable: inspection.action === 'RESTOCKED_TO_AVAILABLE' ? inspection.quantity : 0,
              deltaQuarantine: -inspection.quantity,
              performedByUserId: req.auth!.userId,
              reasonCode: inspection.action === 'RESTOCKED_TO_AVAILABLE'
                ? `Grade A restock for ${current.returnNumber}`
                : `Returned to merchant from ${current.returnNumber}`,
            },
          });
        }

        await transaction.returnItem.update({ where: { id: item.id }, data: { inspectedUnits } });
        inspectedUnitsByItem.set(item.id, inspectedUnits);
      }

      const complete = current.items.every((item) =>
        (inspectedUnitsByItem.get(item.id) ?? item.inspectedUnits) === item.receivedUnits
      );
      if (complete && current.items.some((item) => item.receivedUnits > 0)) {
        await transaction.order.update({ where: { id: current.orderId }, data: { status: 'RETURNED_TO_WAREHOUSE' } });
      }
      const record = await transaction.returnRecord.update({
        where: { id: current.id },
        data: complete ? { status: 'INSPECTED', inspectedAt: new Date() } : {},
        include: returnInclude,
      });
      return { record, complete };
    }, { isolationLevel: 'Serializable' });

    if (outcome.complete) enqueueReturnEvent('return.inspected', outcome.record, req.auth!.userId);
    return res.json({ success: true, return: outcome.record, inspectionComplete: outcome.complete });
  } catch (error) {
    return sendReturnError(error, res);
  }
});

export { returnsRouter };