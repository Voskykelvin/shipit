import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { createPickWaveSchema } from '@shipit/validation';
import { prisma } from '@shipit/database';
import { enqueueDomainEvent } from './jobs.js';

export const pickingRouter = Router();

class PickingRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendPickingError(error: unknown, res: Response) {
  if (error instanceof PickingRequestError) return res.status(error.status).json({ error: error.message });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Pick allocations changed concurrently; retry the operation' });
  }
  console.error('Picking operation failed', error);
  return res.status(503).json({ error: 'Picking service unavailable' });
}

const waveInclude = {
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  tasks: {
    include: {
      orderAllocation: {
        include: {
          product: true,
          location: true,
          orderItem: { include: { order: { select: { id: true, merchantId: true, orderNumber: true } } } },
        },
      },
    },
  },
};

function mapWave(wave: any) {
  return {
    id: wave.id,
    waveNumber: wave.waveNumber,
    status: wave.status,
    assignedTo: wave.assignedTo
      ? { id: wave.assignedTo.id, name: `${wave.assignedTo.firstName} ${wave.assignedTo.lastName}` }
      : undefined,
    taskCount: wave.tasks.length,
    confirmedTaskCount: wave.tasks.filter((task: any) => task.isConfirmed).length,
    tasks: wave.tasks.map((task: any) => ({
      id: task.id,
      allocationId: task.orderAllocation.id,
      orderId: task.orderAllocation.orderItem.order.id,
      orderNumber: task.orderAllocation.orderItem.order.orderNumber,
      productId: task.orderAllocation.productId,
      sku: task.orderAllocation.product.sku,
      productName: task.orderAllocation.product.name,
      barcode: task.orderAllocation.product.barcode,
      quantity: task.orderAllocation.quantity,
      pickedQuantity: task.orderAllocation.pickedQuantity,
      location: {
        id: task.orderAllocation.location.id,
        barcode: task.orderAllocation.location.barcode,
        zone: task.orderAllocation.location.zone,
      },
      isConfirmed: task.isConfirmed,
      scannedBarcode: task.scannedBarcode ?? undefined,
    })),
    startedAt: wave.startedAt?.toISOString(),
    completedAt: wave.completedAt?.toISOString(),
    createdAt: wave.createdAt.toISOString(),
  };
}

function canManageOtherAssignee(req: Request) {
  return ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'WAREHOUSE_SUPERVISOR'].some((role) => req.auth?.roles.has(role));
}

function checkWaveAssignment(req: Request, assignedToUserId: string | null) {
  if (assignedToUserId && assignedToUserId !== req.auth?.userId && !canManageOtherAssignee(req)) {
    throw new PickingRequestError(403, 'Pick wave is assigned to another user');
  }
}

pickingRouter.get('/fulfillment/waves', async (_req: Request, res: Response) => {
  try {
    const waves = await prisma.pickWave.findMany({ include: waveInclude, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(waves.map(mapWave));
  } catch (error) {
    return sendPickingError(error, res);
  }
});

pickingRouter.get('/fulfillment/waves/:id', async (req: Request, res: Response) => {
  try {
    const wave = await prisma.pickWave.findUnique({ where: { id: req.params.id }, include: waveInclude });
    if (!wave) return res.status(404).json({ error: 'Pick wave not found' });
    checkWaveAssignment(req, wave.assignedToUserId);
    return res.json(mapWave(wave));
  } catch (error) {
    return sendPickingError(error, res);
  }
});

pickingRouter.post('/fulfillment/waves', async (req: Request, res: Response) => {
  const parsed = createPickWaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const wave = await prisma.$transaction(async (transaction) => {
      if (parsed.data.assignedToUserId) {
        const assignee = await transaction.user.findUnique({
          where: { id: parsed.data.assignedToUserId },
          include: { roleLinks: { include: { role: true } } },
        });
        if (!assignee || assignee.status !== 'ACTIVE') throw new PickingRequestError(404, 'Active picker not found');
        if (!assignee.roleLinks.some((link) => ['WAREHOUSE_PICKER', 'WAREHOUSE_SUPERVISOR', 'OPERATIONS_MANAGER', 'SUPER_ADMIN'].includes(link.role.name))) {
          throw new PickingRequestError(400, 'Assigned user does not have a warehouse picking role');
        }
      }

      const orders = await transaction.order.findMany({
        where: {
          id: { in: parsed.data.orderIds },
          ...(req.auth?.merchantId ? { merchantId: req.auth.merchantId } : {}),
        },
        include: { items: { include: { allocations: true } } },
      });
      if (orders.length !== parsed.data.orderIds.length) throw new PickingRequestError(404, 'One or more orders were not found');
      if (orders.some((order) => order.status !== 'READY_FOR_PICK')) {
        throw new PickingRequestError(409, 'Every order in a new wave must be ready for picking');
      }

      const allocations = orders.flatMap((order) => order.items.flatMap((item) => item.allocations));
      if (!allocations.length || allocations.some((allocation) => allocation.pickedQuantity > 0)) {
        throw new PickingRequestError(409, 'Orders must have unpicked inventory allocations before wave creation');
      }
      if (orders.some((order) => order.items.some((item) =>
        item.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) !== item.quantity
      ))) {
        throw new PickingRequestError(409, 'At least one order has incomplete stock allocation');
      }

      const activeTask = await transaction.pickTask.findFirst({
        where: {
          orderAllocationId: { in: allocations.map((allocation) => allocation.id) },
          pickWave: { status: { in: ['CREATED', 'IN_PROGRESS'] } },
        },
      });
      if (activeTask) throw new PickingRequestError(409, 'An order allocation already belongs to an active pick wave');

      return transaction.pickWave.create({
        data: {
          waveNumber: `PICK-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
          assignedToUserId: parsed.data.assignedToUserId,
          tasks: { create: allocations.map((allocation) => ({ orderAllocationId: allocation.id })) },
        },
        include: waveInclude,
      });
    }, { isolationLevel: 'Serializable' });

    void enqueueDomainEvent({
      type: 'picking.wave.created',
      entityId: wave.id,
      actorUserId: req.auth!.userId,
      payload: { waveNumber: wave.waveNumber, taskCount: wave.tasks.length },
    }).catch((error: unknown) => console.error('Could not enqueue pick wave event', error));
    return res.status(201).json(mapWave(wave));
  } catch (error) {
    return sendPickingError(error, res);
  }
});

pickingRouter.post('/fulfillment/waves/:id/start', async (req: Request, res: Response) => {
  try {
    const wave = await prisma.$transaction(async (transaction) => {
      const current = await transaction.pickWave.findUnique({ where: { id: req.params.id }, include: waveInclude });
      if (!current) throw new PickingRequestError(404, 'Pick wave not found');
      checkWaveAssignment(req, current.assignedToUserId);
      if (current.status !== 'CREATED' || current.tasks.length === 0) {
        throw new PickingRequestError(409, 'Only non-empty created waves can be started');
      }

      const orderIds = [...new Set(current.tasks.map((task) => task.orderAllocation.orderItem.order.id))];
      const startedOrders = await transaction.order.updateMany({
        where: { id: { in: orderIds }, status: 'READY_FOR_PICK' },
        data: { status: 'PICKING' },
      });
      if (startedOrders.count !== orderIds.length) {
        throw new PickingRequestError(409, 'One or more wave orders are no longer ready for picking');
      }
      return transaction.pickWave.update({
        where: { id: current.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
        include: waveInclude,
      });
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, wave: mapWave(wave) });
  } catch (error) {
    return sendPickingError(error, res);
  }
});

pickingRouter.post('/fulfillment/waves/:id/complete', async (req: Request, res: Response) => {
  try {
    const wave = await prisma.$transaction(async (transaction) => {
      const current = await transaction.pickWave.findUnique({ where: { id: req.params.id }, include: waveInclude });
      if (!current) throw new PickingRequestError(404, 'Pick wave not found');
      checkWaveAssignment(req, current.assignedToUserId);
      if (current.status !== 'IN_PROGRESS') throw new PickingRequestError(409, 'Pick wave is not in progress');
      if (current.tasks.some((task) => !task.isConfirmed)) throw new PickingRequestError(409, 'Every pick task must be confirmed before completion');

      return transaction.pickWave.update({
        where: { id: current.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: waveInclude,
      });
    }, { isolationLevel: 'Serializable' });
    void enqueueDomainEvent({
      type: 'picking.wave.completed',
      entityId: wave.id,
      actorUserId: req.auth!.userId,
      payload: { waveNumber: wave.waveNumber },
    }).catch((error: unknown) => console.error('Could not enqueue pick completion event', error));
    return res.json({ success: true, wave: mapWave(wave) });
  } catch (error) {
    return sendPickingError(error, res);
  }
});