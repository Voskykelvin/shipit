import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import { Request, Response, Router } from 'express';
import {
  createOrderSchema,
  packOrderSchema,
  pickAllocationSchema,
  verifyOrderSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';
import { enqueueDomainEvent } from './jobs.js';
import { OrderCsvError, parseOrderCsv } from './orderImport.js';

const ordersRouter = Router();

class OrderRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendOrderError(error: unknown, res: Response) {
  if (error instanceof OrderRequestError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof OrderCsvError) return res.status(400).json({ error: error.message });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Order or stock changed concurrently; retry the operation' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    return res.status(409).json({ error: 'Order number or external reference already exists' });
  }
  console.error('Order database operation failed', error);
  return res.status(503).json({ error: 'Order service unavailable' });
}

function mapOrder(order: any) {
  return {
    id: order.id,
    merchantId: order.merchantId,
    orderNumber: order.orderNumber,
    externalReference: order.externalReference ?? undefined,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAltPhone: order.customerAltPhone ?? undefined,
    address: {
      county: order.county,
      townOrSubCounty: order.townOrSubCounty,
      estateOrArea: order.estateOrArea,
      buildingOrCourt: order.buildingOrCourt ?? undefined,
      landmark: order.landmark,
      gpsLatitude: order.gpsLatitude === null ? undefined : Number(order.gpsLatitude),
      gpsLongitude: order.gpsLongitude === null ? undefined : Number(order.gpsLongitude),
      googleMapsUrl: order.googleMapsUrl ?? undefined,
      whatsappLocationText: order.whatsappLocationText ?? undefined,
    },
    items: order.items.map((item: any) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      sku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceKes: item.unitPriceKes,
      allocatedLocationId: item.allocations[0]?.locationId ?? item.allocatedLocationId ?? undefined,
    })),
    orderValueKes: order.orderValueKes,
    deliveryFeeKes: order.deliveryFeeKes,
    codAmountExpectedKes: order.codAmountExpectedKes,
    paymentMethod: order.paymentMethod,
    status: order.status,
    preferredDeliveryDate: order.preferredDeliveryDate?.toISOString().slice(0, 10),
    verificationNotes: order.verificationNotes ?? undefined,
    verifiedByUserId: order.verifiedByUserId ?? undefined,
    verifiedAt: order.verifiedAt?.toISOString(),
    waybillNumber: order.waybill?.trackingNumber ?? order.waybillNumber ?? undefined,
    manifestId: order.manifestId ?? undefined,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

const orderInclude = {
  items: {
    include: {
      product: true,
      allocations: true,
    },
  },
  waybill: true,
} satisfies Prisma.OrderInclude;

async function reserveOrderItems(
  transaction: Prisma.TransactionClient,
  orderId: string,
  orderNumber: string,
  userId: string,
) {
  const items = await transaction.orderItem.findMany({
    where: { orderId },
    include: { product: true },
  });

  for (const item of items) {
    let remaining = item.quantity;
    const levels = await transaction.inventoryLevel.findMany({
      where: { productId: item.productId, availableQty: { gt: 0 } },
      include: { location: true },
      orderBy: [{ location: { zone: 'asc' } }, { location: { aisle: 'asc' } }, { location: { rack: 'asc' } }],
    });

    for (const level of levels) {
      if (remaining === 0) break;
      const allocatedQuantity = Math.min(remaining, level.availableQty);
      const changed = await transaction.inventoryLevel.updateMany({
        where: { id: level.id, availableQty: { gte: allocatedQuantity } },
        data: {
          availableQty: { decrement: allocatedQuantity },
          reservedQty: { increment: allocatedQuantity },
        },
      });
      if (changed.count !== 1) throw new OrderRequestError(409, 'Stock changed while reserving this order; retry');

      await transaction.orderAllocation.create({
        data: {
          orderItemId: item.id,
          productId: item.productId,
          locationId: level.locationId,
          quantity: allocatedQuantity,
        },
      });
      await transaction.inventoryTransaction.create({
        data: {
          merchantId: item.product.merchantId,
          productId: item.productId,
          locationId: level.locationId,
          type: 'ORDER_RESERVE',
          referenceId: orderNumber,
          deltaAvailable: -allocatedQuantity,
          deltaReserved: allocatedQuantity,
          performedByUserId: userId,
          reasonCode: `Reserved for ${orderNumber}`,
        },
      });
      remaining -= allocatedQuantity;
    }

    if (remaining > 0) {
      throw new OrderRequestError(409, `Insufficient available stock for SKU ${item.product.sku}`);
    }
  }
}

type NewOrderInput = ReturnType<typeof createOrderSchema.parse>;

async function createOrderInTransaction(
  transaction: Prisma.TransactionClient,
  data: NewOrderInput,
  userId: string,
  orderSource: 'MANUAL' | 'CSV',
) {
  const orderNumber = `ORD-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const orderValueKes = data.items.reduce((total, item) => total + item.quantity * item.unitPriceKes, 0);
  const isCod = data.paymentMethod !== 'PREPAID';
  const merchant = await transaction.merchant.findUnique({ where: { id: data.merchantId } });
  if (!merchant || merchant.status !== 'ACTIVE') throw new OrderRequestError(404, 'Active merchant not found');

  const products = await transaction.product.findMany({
    where: { merchantId: data.merchantId, id: { in: data.items.map((item) => item.productId) } },
  });
  if (products.length !== new Set(data.items.map((item) => item.productId)).size) {
    throw new OrderRequestError(400, 'Order contains a product not owned by this merchant');
  }

  const created = await transaction.order.create({
    data: {
      merchantId: data.merchantId,
      orderNumber,
      externalReference: data.externalReference?.trim() || null,
      orderSource,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAltPhone: data.customerAltPhone || null,
      county: data.address.county,
      townOrSubCounty: data.address.townOrSubCounty,
      estateOrArea: data.address.estateOrArea,
      buildingOrCourt: data.address.buildingOrCourt,
      landmark: data.address.landmark,
      gpsLatitude: data.address.gpsLatitude,
      gpsLongitude: data.address.gpsLongitude,
      googleMapsUrl: data.address.googleMapsUrl || null,
      whatsappLocationText: data.address.whatsappLocationText || null,
      orderValueKes,
      deliveryFeeKes: data.deliveryFeeKes,
      codAmountExpectedKes: isCod ? orderValueKes + data.deliveryFeeKes : 0,
      paymentMethod: data.paymentMethod,
      status: isCod ? 'PENDING_VERIFICATION' : 'READY_FOR_PICK',
      preferredDeliveryDate: data.preferredDeliveryDate ? new Date(data.preferredDeliveryDate) : null,
      verificationNotes: data.verificationNotes,
      items: { create: data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceKes: item.unitPriceKes,
      })) },
    },
  });

  if (!isCod) await reserveOrderItems(transaction, created.id, orderNumber, userId);
  return transaction.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
}

ordersRouter.get('/orders', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const merchantId = typeof req.query.merchantId === 'string' ? req.query.merchantId : req.auth?.merchantId;
  if (merchantId && !canAccessMerchant(req, merchantId)) {
    return res.status(403).json({ error: 'Cannot access another merchant' });
  }

  try {
    const rows = await prisma.order.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        ...(status ? { status: status as Prisma.EnumOrderStatusFilter['equals'] } : {}),
        ...(search ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerPhone: { contains: search } },
            { waybillNumber: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return res.json(rows.map(mapOrder));
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
      include: orderInclude,
    });
    if (!order || !canAccessMerchant(req, order.merchantId)) return res.status(404).json({ error: 'Order not found' });
    return res.json(mapOrder(order));
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/orders', async (req: Request, res: Response) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  if (!canAccessMerchant(req, parsed.data.merchantId)) {
    return res.status(403).json({ error: 'Cannot create an order for another merchant' });
  }

  try {
    const order = await prisma.$transaction(async (transaction) => {
      return createOrderInTransaction(transaction, parsed.data, req.auth!.userId, 'MANUAL');
    }, { isolationLevel: 'Serializable' });
    void enqueueDomainEvent({
      type: 'order.created',
      entityId: order.id,
      merchantId: order.merchantId,
      actorUserId: req.auth!.userId,
      payload: { orderNumber: order.orderNumber, status: order.status },
    }).catch((error: unknown) => console.error('Could not enqueue order-created event', error));
    return res.status(201).json(mapOrder(order));
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/orders/import', async (req: Request, res: Response) => {
  if (typeof req.body !== 'string') return res.status(415).json({ error: 'Send the CSV file using Content-Type: text/csv' });

  try {
    const groupedOrders = parseOrderCsv(req.body);
    if (groupedOrders.length > 200) throw new OrderRequestError(413, 'A single import may contain at most 200 orders');
    for (const order of groupedOrders) {
      if (!canAccessMerchant(req, order.merchantId)) throw new OrderRequestError(403, 'Cannot import orders for another merchant');
    }

    const createdOrders = await prisma.$transaction(async (transaction) => {
      const merchantIds = [...new Set(groupedOrders.map((order) => order.merchantId))];
      const skus = [...new Set(groupedOrders.flatMap((order) => order.items.map((item) => item.sku)))];
      const products = await transaction.product.findMany({ where: { merchantId: { in: merchantIds }, sku: { in: skus } } });
      const productByMerchantAndSku = new Map(products.map((product) => [`${product.merchantId}\u0000${product.sku}`, product]));
      const created = [];

      for (const imported of groupedOrders) {
        const items = imported.items.map((item) => {
          const product = productByMerchantAndSku.get(`${imported.merchantId}\u0000${item.sku}`);
          if (!product) throw new OrderRequestError(400, `Unknown product SKU ${item.sku} for merchant ${imported.merchantId}`);
          return { productId: product.id, quantity: item.quantity, unitPriceKes: item.unitPriceKes };
        });
        const orderData = createOrderSchema.safeParse({ ...imported, items });
        if (!orderData.success) throw new OrderRequestError(400, `Order ${imported.externalReference} is invalid: ${orderData.error.issues[0]?.message ?? 'invalid values'}`);
        created.push(await createOrderInTransaction(transaction, orderData.data, req.auth!.userId, 'CSV'));
      }
      return created;
    }, { isolationLevel: 'Serializable' });

    void enqueueDomainEvent({
      type: 'orders.bulk_imported',
      entityId: createdOrders[0]?.id ?? 'empty',
      actorUserId: req.auth!.userId,
      payload: { importedCount: createdOrders.length, orderIds: createdOrders.map((order) => order.id) },
    }).catch((error: unknown) => console.error('Could not enqueue bulk import event', error));
    return res.status(201).json({ importedCount: createdOrders.length, orders: createdOrders.map(mapOrder) });
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/orders/:id/verify', async (req: Request, res: Response) => {
  const parsed = verifyOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.order.findUnique({ where: { id: req.params.id } });
      if (!existing || !canAccessMerchant(req, existing.merchantId)) throw new OrderRequestError(404, 'Order not found');
      if (existing.status !== 'PENDING_VERIFICATION') throw new OrderRequestError(409, 'Order is not awaiting verification');

      if (parsed.data.isConfirmed) {
        await reserveOrderItems(transaction, existing.id, existing.orderNumber, req.auth!.userId);
      } else {
        const paidTransaction = await transaction.cODTransaction.findFirst({
          where: { orderId: existing.id, status: { not: 'DISPUTED' } },
        });
        if (paidTransaction) throw new OrderRequestError(409, 'An order with collected COD cannot be cancelled during verification');
      }
      return transaction.order.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.isConfirmed ? 'READY_FOR_PICK' : 'CANCELLED',
          verificationNotes: parsed.data.notes,
          verifiedByUserId: req.auth!.userId,
          verifiedAt: new Date(),
        },
        include: orderInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/orders/:id/cancel', async (req: Request, res: Response) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : 'Cancelled by merchant or operations';

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.order.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { allocations: true } } },
      });
      if (!existing || !canAccessMerchant(req, existing.merchantId)) throw new OrderRequestError(404, 'Order not found');
      if (!['PENDING_VERIFICATION', 'READY_FOR_PICK'].includes(existing.status)) {
        throw new OrderRequestError(409, 'Order can no longer be cancelled at this stage');
      }
      const paidTransaction = await transaction.cODTransaction.findFirst({
        where: { orderId: existing.id, status: { not: 'DISPUTED' } },
      });
      if (paidTransaction) throw new OrderRequestError(409, 'An order with collected COD cannot be cancelled');

      const allocationIds = existing.items.flatMap((item) => item.allocations.map((allocation) => allocation.id));
      const activeTasks = await transaction.pickTask.findMany({
        where: {
          orderAllocationId: { in: allocationIds },
          pickWave: { status: { in: ['CREATED', 'IN_PROGRESS'] } },
        },
        include: { pickWave: true },
      });
      if (activeTasks.some((task) => task.pickWave.status === 'IN_PROGRESS')) {
        throw new OrderRequestError(409, 'An order in an active pick wave cannot be cancelled');
      }
      if (activeTasks.length) {
        await transaction.pickTask.deleteMany({ where: { id: { in: activeTasks.map((task) => task.id) } } });
        for (const waveId of new Set(activeTasks.map((task) => task.pickWaveId))) {
          const remainingTasks = await transaction.pickTask.count({ where: { pickWaveId: waveId } });
          if (remainingTasks === 0) {
            await transaction.pickWave.update({ where: { id: waveId }, data: { status: 'COMPLETED', completedAt: new Date() } });
          }
        }
      }

      for (const item of existing.items) {
        for (const allocation of item.allocations) {
          const released = await transaction.inventoryLevel.updateMany({
            where: {
              productId: item.productId,
              locationId: allocation.locationId,
              reservedQty: { gte: allocation.quantity },
            },
            data: {
              availableQty: { increment: allocation.quantity },
              reservedQty: { decrement: allocation.quantity },
            },
          });
          if (released.count !== 1) throw new OrderRequestError(409, 'Reserved stock is inconsistent; contact a supervisor');
          await transaction.inventoryTransaction.create({
            data: {
              merchantId: existing.merchantId,
              productId: item.productId,
              locationId: allocation.locationId,
              type: 'ORDER_CANCEL_RELEASE',
              referenceId: existing.orderNumber,
              deltaAvailable: allocation.quantity,
              deltaReserved: -allocation.quantity,
              performedByUserId: req.auth!.userId,
              reasonCode: `Released after cancelling ${existing.orderNumber}`,
            },
          });
        }
      }

      return transaction.order.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED', verificationNotes: notes },
        include: orderInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/fulfillment/pick', async (req: Request, res: Response) => {
  const parsed = pickAllocationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.order.findUnique({
        where: { id: parsed.data.orderId },
        include: { items: { include: { product: true, allocations: true } } },
      });
      if (!existing || !canAccessMerchant(req, existing.merchantId)) throw new OrderRequestError(404, 'Order not found');
      if (!['READY_FOR_PICK', 'PICKING'].includes(existing.status)) throw new OrderRequestError(409, 'Order is not ready for picking');

      const allocation = existing.items.flatMap((item) => item.allocations.map((entry) => ({ item, entry })))
        .find(({ entry }) => entry.id === parsed.data.allocationId);
      if (!allocation) throw new OrderRequestError(404, 'Pick allocation not found');

      const activeTask = await transaction.pickTask.findFirst({
        where: {
          orderAllocationId: allocation.entry.id,
          pickWave: { status: { in: ['CREATED', 'IN_PROGRESS'] } },
        },
        include: { pickWave: true },
      });
      if (activeTask && (activeTask.pickWave.status !== 'IN_PROGRESS' || parsed.data.pickTaskId !== activeTask.id)) {
        throw new OrderRequestError(409, 'Scan the active pick-wave task to pick this allocation');
      }
      if (!activeTask && parsed.data.pickTaskId) throw new OrderRequestError(404, 'Active pick task not found');
      if (activeTask?.pickWave.assignedToUserId && activeTask.pickWave.assignedToUserId !== req.auth!.userId &&
        !['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'WAREHOUSE_SUPERVISOR'].some((role) => req.auth?.roles.has(role))) {
        throw new OrderRequestError(403, 'Pick task is assigned to another user');
      }
      if (allocation.item.product.barcode.toLowerCase() !== parsed.data.scannedBarcode.trim().toLowerCase()) {
        throw new OrderRequestError(409, 'Scanned barcode does not match the allocated product');
      }
      if (allocation.entry.pickedQuantity + parsed.data.quantity > allocation.entry.quantity) {
        throw new OrderRequestError(409, 'Pick quantity exceeds allocated quantity');
      }

      const inventoryUpdate = await transaction.inventoryLevel.updateMany({
        where: {
          productId: allocation.item.productId,
          locationId: allocation.entry.locationId,
          reservedQty: { gte: parsed.data.quantity },
        },
        data: { reservedQty: { decrement: parsed.data.quantity } },
      });
      if (inventoryUpdate.count !== 1) throw new OrderRequestError(409, 'Reserved stock is inconsistent; contact a supervisor');

      const pickedQuantity = allocation.entry.pickedQuantity + parsed.data.quantity;
      await transaction.orderAllocation.update({
        where: { id: allocation.entry.id },
        data: {
          pickedQuantity,
          scannedBarcode: parsed.data.scannedBarcode,
          pickedAt: pickedQuantity === allocation.entry.quantity ? new Date() : null,
          pickedByUserId: req.auth!.userId,
        },
      });
      if (activeTask && pickedQuantity === allocation.entry.quantity) {
        await transaction.pickTask.update({
          where: { id: activeTask.id },
          data: { isConfirmed: true, scannedBarcode: parsed.data.scannedBarcode, confirmedAt: new Date() },
        });
      }
      await transaction.inventoryTransaction.create({
        data: {
          merchantId: existing.merchantId,
          productId: allocation.item.productId,
          locationId: allocation.entry.locationId,
          type: 'ORDER_PICK',
          referenceId: existing.orderNumber,
          deltaReserved: -parsed.data.quantity,
          performedByUserId: req.auth!.userId,
          reasonCode: `Picked for ${existing.orderNumber}`,
        },
      });

      return transaction.order.update({
        where: { id: existing.id },
        data: { status: 'PICKING' },
        include: orderInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.post('/fulfillment/pack', async (req: Request, res: Response) => {
  const parsed = packOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.order.findUnique({
        where: { id: parsed.data.orderId },
        include: { items: { include: { product: true, allocations: true } } },
      });
      if (!existing || !canAccessMerchant(req, existing.merchantId)) throw new OrderRequestError(404, 'Order not found');
      if (existing.status !== 'PICKING') throw new OrderRequestError(409, 'Order must be in picking before packing');
      if (existing.items.some((item) => item.allocations.reduce((sum, allocation) => sum + allocation.pickedQuantity, 0) !== item.quantity)) {
        throw new OrderRequestError(409, 'All allocated units must be picked before packing');
      }

      const expectedBarcodes = existing.items.flatMap((item) => Array(item.quantity).fill(item.product.barcode)).sort();
      const scannedBarcodes = parsed.data.scannedProductBarcodes.map((barcode) => barcode.trim()).sort();
      if (expectedBarcodes.length !== scannedBarcodes.length || expectedBarcodes.some((barcode, index) => barcode.toLowerCase() !== scannedBarcodes[index].toLowerCase())) {
        throw new OrderRequestError(409, 'Pack scan does not match the order items');
      }

      const trackingNumber = `WB-${randomBytes(5).toString('hex').toUpperCase()}-KE`;
      await transaction.waybill.create({
        data: {
          orderId: existing.id,
          trackingNumber,
          barcodeCode128: trackingNumber,
          qrCodePayload: JSON.stringify({ orderNumber: existing.orderNumber, trackingNumber }),
        },
      });
      return transaction.order.update({
        where: { id: existing.id },
        data: { status: 'PACKED', waybillNumber: trackingNumber },
        include: orderInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, order: mapOrder(order) });
  } catch (error) {
    return sendOrderError(error, res);
  }
});

ordersRouter.get('/waybills/:trackingNumber/label.pdf', async (req: Request, res: Response) => {
  try {
    const waybill = await prisma.waybill.findUnique({
      where: { trackingNumber: req.params.trackingNumber },
      include: {
        order: {
          include: {
            merchant: true,
            items: { include: { product: true } },
          },
        },
      },
    });
    if (!waybill || !canAccessMerchant(req, waybill.order.merchantId)) {
      return res.status(404).json({ error: 'Waybill not found' });
    }

    const [barcode, qrCode] = await Promise.all([
      bwipjs.toBuffer({
        bcid: 'code128',
        text: waybill.barcodeCode128,
        scale: 2,
        height: 12,
        includetext: true,
        textsize: 10,
      }),
      QRCode.toBuffer(waybill.qrCodePayload, { type: 'png', width: 90, margin: 1 }),
    ]);

    const order = waybill.order;
    const phone = order.customerPhone.replace(/\D/g, '');
    const maskedPhone = phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
    const document = new PDFDocument({ size: [288, 432], margin: 16, compress: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${waybill.trackingNumber}.pdf"`);
    document.pipe(res);

    document.font('Helvetica-Bold').fontSize(12).text('SHIP IT', 16, 16, { continued: true });
    document.font('Helvetica').fontSize(8).text('  NAIROBI FULFILLMENT', { align: 'right' });
    document.moveDown(0.4);
    document.font('Helvetica-Bold').fontSize(8).text(`ROUTE: ${order.townOrSubCounty.toUpperCase()}`);
    document.font('Helvetica-Bold').fontSize(9).text(`TRACKING: ${waybill.trackingNumber}`);
    document.image(barcode, 18, 58, { fit: [252, 62], align: 'center' });

    document.moveTo(16, 128).lineTo(272, 128).stroke();
    document.font('Helvetica-Bold').fontSize(8).text('RECIPIENT', 16, 136);
    document.font('Helvetica-Bold').fontSize(11).text(order.customerName, 16, 148, { width: 178 });
    document.font('Helvetica').fontSize(9).text(maskedPhone, 16, 163, { width: 178 });
    document.font('Helvetica-Bold').fontSize(8).text('DELIVERY ADDRESS', 16, 184);
    document.font('Helvetica').fontSize(9).text(
      [order.county, order.townOrSubCounty, order.estateOrArea, order.buildingOrCourt, order.landmark].filter(Boolean).join('\n'),
      16,
      196,
      { width: 178, height: 78, ellipsis: true }
    );
    document.image(qrCode, 204, 143, { fit: [68, 68] });

    document.moveTo(16, 286).lineTo(272, 286).stroke();
    document.font('Helvetica-Bold').fontSize(8).text(`MERCHANT: ${order.merchant.name}`, 16, 294, { width: 256 });
    document.font('Helvetica').fontSize(8).text(`ORDER: ${order.orderNumber}`, 16, 307);
    document.font('Helvetica-Bold').fontSize(10).text(
      order.paymentMethod === 'PREPAID' ? 'PREPAID' : `COD TO COLLECT: KES ${order.codAmountExpectedKes.toLocaleString('en-KE')}`,
      16,
      323,
      { width: 256 }
    );
    document.font('Helvetica').fontSize(7).text(
      order.items.map((item) => `${item.quantity}x ${item.product.name}`).join('\n'),
      16,
      344,
      { width: 256, height: 48, ellipsis: true }
    );
    document.end();
    return;
  } catch (error) {
    console.error('Waybill label generation failed', error);
    if (!res.headersSent) return res.status(503).json({ error: 'Waybill label unavailable' });
  }
});

export { ordersRouter };
