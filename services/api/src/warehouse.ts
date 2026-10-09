import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import {
  createInboundShipmentSchema,
  inventoryAdjustmentSchema,
  receiveInboundShipmentSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';

const warehouseRouter = Router();

class WarehouseRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendWarehouseError(error: unknown, res: Response) {
  if (error instanceof WarehouseRequestError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Inventory changed concurrently; retry the operation' });
  }

  console.error('Warehouse database operation failed', error);
  return res.status(503).json({ error: 'Warehouse service unavailable' });
}

function newDocumentNumber(prefix: 'ASN' | 'GRN' | 'ADJ') {
  const date = new Date();
  const day = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('');
  return `${prefix}-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

warehouseRouter.get('/inventory/stock', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      include: { inventory: true },
      orderBy: { sku: 'asc' },
    });

    return res.json(products.map((product) => {
      const totals = product.inventory.reduce((stock, level) => ({
        availableQty: stock.availableQty + level.availableQty,
        reservedQty: stock.reservedQty + level.reservedQty,
        damagedQty: stock.damagedQty + level.damagedQty,
        quarantineQty: stock.quarantineQty + level.quarantineQty,
      }), { availableQty: 0, reservedQty: 0, damagedQty: 0, quarantineQty: 0 });

      return {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        merchantId: product.merchantId,
        ...totals,
        totalPhysicalQty: totals.availableQty + totals.reservedQty + totals.damagedQty + totals.quarantineQty,
      };
    }));
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.get('/inventory/locations', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.warehouseLocation.findMany({
      where: { warehouse: { isActive: true } },
      orderBy: [{ warehouseId: 'asc' }, { zone: 'asc' }, { aisle: 'asc' }, { rack: 'asc' }, { shelf: 'asc' }, { bin: 'asc' }],
    });
    return res.json(rows);
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.get('/inventory/transactions', async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return res.json(transactions);
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.get('/inbound/warehouses', async (_req: Request, res: Response) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return res.json(warehouses);
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.post('/inventory/adjust', async (req: Request, res: Response) => {
  const parsed = inventoryAdjustmentSchema.safeParse({
    ...req.body,
    supervisorApprovedBy: req.auth?.userId,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [product, location] = await Promise.all([
        transaction.product.findUnique({ where: { id: parsed.data.productId } }),
        transaction.warehouseLocation.findUnique({ where: { id: parsed.data.locationId } }),
      ]);
      if (!product || !location || !canAccessMerchant(req, product.merchantId)) {
        throw new WarehouseRequestError(404, 'Product or warehouse location not found');
      }

      const key = { productId: parsed.data.productId, locationId: parsed.data.locationId };
      const current = await transaction.inventoryLevel.findUnique({ where: { productId_locationId: key } });
      const availableQty = (current?.availableQty ?? 0) + parsed.data.deltaAvailable;
      const damagedQty = (current?.damagedQty ?? 0) + parsed.data.deltaDamaged;
      const quarantineQty = (current?.quarantineQty ?? 0) + parsed.data.deltaQuarantine;
      if (availableQty < 0 || damagedQty < 0 || quarantineQty < 0) {
        throw new WarehouseRequestError(409, 'Adjustment would make an inventory balance negative');
      }

      const stock = await transaction.inventoryLevel.upsert({
        where: { productId_locationId: key },
        create: {
          ...key,
          availableQty,
          reservedQty: current?.reservedQty ?? 0,
          damagedQty,
          quarantineQty,
        },
        update: {
          availableQty: { increment: parsed.data.deltaAvailable },
          damagedQty: { increment: parsed.data.deltaDamaged },
          quarantineQty: { increment: parsed.data.deltaQuarantine },
        },
      });
      const ledgerEntry = await transaction.inventoryTransaction.create({
        data: {
          merchantId: product.merchantId,
          ...key,
          type: 'SUPERVISOR_ADJUSTMENT',
          referenceId: newDocumentNumber('ADJ'),
          deltaAvailable: parsed.data.deltaAvailable,
          deltaDamaged: parsed.data.deltaDamaged,
          deltaQuarantine: parsed.data.deltaQuarantine,
          performedByUserId: req.auth!.userId,
          supervisorApprovedBy: req.auth!.userId,
          reasonCode: parsed.data.reasonCode,
        },
      });
      return { stock, ledgerEntry, product };
    }, { isolationLevel: 'Serializable' });

    return res.json({
      success: true,
      stock: {
        productId: result.product.id,
        sku: result.product.sku,
        productName: result.product.name,
        merchantId: result.product.merchantId,
        availableQty: result.stock.availableQty,
        reservedQty: result.stock.reservedQty,
        damagedQty: result.stock.damagedQty,
        quarantineQty: result.stock.quarantineQty,
        totalPhysicalQty: result.stock.availableQty + result.stock.reservedQty + result.stock.damagedQty + result.stock.quarantineQty,
      },
      transaction: result.ledgerEntry,
    });
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.get('/inbound', async (req: Request, res: Response) => {
  try {
    const shipments = await prisma.inboundShipment.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(shipments);
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.post('/inbound', async (req: Request, res: Response) => {
  const parsed = createInboundShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  }

  const merchantId = req.auth?.merchantId ?? parsed.data.merchantId;
  if (!canAccessMerchant(req, merchantId)) {
    return res.status(403).json({ error: 'Cannot create an ASN for another merchant' });
  }

  try {
    const [merchant, warehouse, products] = await Promise.all([
      prisma.merchant.findUnique({ where: { id: merchantId } }),
      prisma.warehouse.findFirst({ where: { id: parsed.data.warehouseId, isActive: true } }),
      prisma.product.findMany({
        where: { merchantId, id: { in: parsed.data.items.map((item) => item.productId) } },
        select: { id: true },
      }),
    ]);
    if (!merchant || merchant.status !== 'ACTIVE' || !warehouse) {
      return res.status(404).json({ error: 'Merchant or active warehouse not found' });
    }
    if (products.length !== parsed.data.items.length) {
      return res.status(400).json({ error: 'ASN contains a product not owned by this merchant' });
    }

    const shipment = await prisma.inboundShipment.create({
      data: {
        merchantId,
        warehouseId: warehouse.id,
        asnNumber: newDocumentNumber('ASN'),
        expectedDeliveryDate: new Date(`${parsed.data.expectedDeliveryDate}T00:00:00.000Z`),
        notes: parsed.data.notes,
        items: { create: parsed.data.items },
      },
      include: { items: true },
    });
    return res.status(201).json(shipment);
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

warehouseRouter.post('/inbound/:id/receive', async (req: Request, res: Response) => {
  const parsed = receiveInboundShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  }

  try {
    const shipment = await prisma.$transaction(async (transaction) => {
      const asn = await transaction.inboundShipment.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!asn || !canAccessMerchant(req, asn.merchantId)) {
        throw new WarehouseRequestError(404, 'ASN not found');
      }
      if (asn.status === 'COMPLETED' || asn.status === 'CANCELLED') {
        throw new WarehouseRequestError(409, 'ASN cannot receive additional units');
      }

      const nextReceived = new Map(asn.items.map((item) => [item.id, item.receivedUnits]));
      for (const receipt of parsed.data.items) {
        const item = asn.items.find((candidate) => candidate.id === receipt.inboundItemId);
        if (!item) throw new WarehouseRequestError(400, 'Receipt contains an item outside this ASN');
        if (item.receivedUnits + receipt.receivedUnits > item.expectedUnits) {
          throw new WarehouseRequestError(409, `Receipt exceeds expected units for item ${item.id}`);
        }

        const location = await transaction.warehouseLocation.findFirst({
          where: { id: receipt.locationId, warehouseId: asn.warehouseId },
        });
        if (!location) throw new WarehouseRequestError(400, 'Putaway location must belong to the ASN warehouse');

        const key = { productId: item.productId, locationId: location.id };
        await transaction.inventoryLevel.upsert({
          where: { productId_locationId: key },
          create: {
            ...key,
            availableQty: receipt.receivedUnits - receipt.damagedUnits,
            damagedQty: receipt.damagedUnits,
          },
          update: {
            availableQty: { increment: receipt.receivedUnits - receipt.damagedUnits },
            damagedQty: { increment: receipt.damagedUnits },
          },
        });
        await transaction.inventoryTransaction.create({
          data: {
            merchantId: asn.merchantId,
            ...key,
            type: 'ASN_RECEIVE',
            referenceId: asn.asnNumber,
            deltaAvailable: receipt.receivedUnits - receipt.damagedUnits,
            deltaDamaged: receipt.damagedUnits,
            performedByUserId: req.auth!.userId,
            reasonCode: `Received against ${asn.asnNumber}`,
          },
        });
        await transaction.inboundItem.update({
          where: { id: item.id },
          data: {
            receivedUnits: { increment: receipt.receivedUnits },
            damagedUnits: { increment: receipt.damagedUnits },
            locationId: location.id,
          },
        });
        await transaction.warehouseLocation.update({ where: { id: location.id }, data: { isOccupied: true } });
        nextReceived.set(item.id, item.receivedUnits + receipt.receivedUnits);
      }

      const isComplete = asn.items.every((item) => (nextReceived.get(item.id) ?? item.receivedUnits) >= item.expectedUnits);
      const grnNumber = asn.grnNumber ?? newDocumentNumber('GRN');
      return transaction.inboundShipment.update({
        where: { id: asn.id },
        data: {
          status: isComplete ? 'COMPLETED' : 'PARTIALLY_RECEIVED',
          grnNumber,
        },
        include: { items: true },
      });
    }, { isolationLevel: 'Serializable' });

    return res.json({ success: true, asn: shipment });
  } catch (error) {
    return sendWarehouseError(error, res);
  }
});

export { warehouseRouter };
