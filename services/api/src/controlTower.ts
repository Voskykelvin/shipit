import { Request, Response, Router } from 'express';
import { prisma } from '@shipit/database';

export const controlTowerRouter = Router();

function merchantScope(req: Request) {
  return req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined;
}

async function getActiveExceptions(req: Request) {
  const merchantId = req.auth?.merchantId;
  const verificationCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const [openNdr, openShifts, verificationQueue, returns] = await Promise.all([
    prisma.nDRCase.findMany({
      where: { status: { in: ['OPEN', 'ESCALATED'] }, ...(merchantId ? { order: { merchantId } } : {}) },
      include: { order: true, deliveryAttempt: { include: { rider: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    merchantId ? Promise.resolve([]) : prisma.riderShift.findMany({
      where: { isReconciled: false, varianceKes: { not: 0 } },
      include: { rider: { include: { user: true } } },
      orderBy: { shiftDate: 'desc' },
      take: 200,
    }),
    prisma.order.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: 'PENDING_VERIFICATION',
        createdAt: { lte: verificationCutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, orderNumber: true, townOrSubCounty: true, createdAt: true },
    }),
    prisma.returnRecord.findMany({
      where: {
        ...(merchantId ? { merchantId } : {}),
        status: { in: ['IN_TRANSIT', 'RECEIVED_AT_WAREHOUSE'] },
      },
      include: { order: { select: { orderNumber: true } } },
      orderBy: { initiatedAt: 'asc' },
      take: 200,
    }),
  ]);

  return [
    ...openNdr.map((item) => ({
      id: item.id,
      category: 'FAILED_DELIVERY',
      severity: 'HIGH',
      title: `NDR: ${item.order.orderNumber}`,
      details: `${item.deliveryAttempt.rider.user.firstName} ${item.deliveryAttempt.rider.user.lastName} reported ${item.deliveryAttempt.failureReason} in ${item.order.townOrSubCounty}.`,
      entityId: item.orderId,
      entityType: 'ORDER',
      isResolved: false,
      createdAt: item.createdAt.toISOString(),
    })),
    ...openShifts.map((shift) => ({
      id: shift.id,
      category: 'COD_VARIANCE',
      severity: 'HIGH',
      title: `Rider cash variance: ${shift.rider.user.firstName} ${shift.rider.user.lastName}`,
      details: `Shift ${shift.id} has a KES ${shift.varianceKes} cash variance awaiting manager approval.`,
      entityId: shift.id,
      entityType: 'RIDER_SHIFT',
      isResolved: false,
      createdAt: shift.openingTimestamp.toISOString(),
    })),
    ...verificationQueue.map((order) => ({
      id: `verification-${order.id}`,
      category: 'PENDING_VERIFICATION',
      severity: 'MEDIUM',
      title: `Order awaiting verification: ${order.orderNumber}`,
      details: `Order in ${order.townOrSubCounty} has been waiting for more than two hours.`,
      entityId: order.id,
      entityType: 'ORDER',
      isResolved: false,
      createdAt: order.createdAt.toISOString(),
    })),
    ...returns.map((record) => ({
      id: `return-${record.id}`,
      category: 'RETURN_IN_PROGRESS',
      severity: 'MEDIUM',
      title: `Return needs handling: ${record.returnNumber}`,
      details: `${record.order.orderNumber} is ${record.status.toLowerCase().replaceAll('_', ' ')}.`,
      entityId: record.id,
      entityType: 'RETURN',
      isResolved: false,
      createdAt: record.initiatedAt.toISOString(),
    })),
  ];
}

controlTowerRouter.get('/control-tower/summary', async (req: Request, res: Response) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const merchantId = req.auth?.merchantId;
  try {
    const [ordersToday, statuses, collectedCod, pendingCod, attempts, activeExceptions] = await Promise.all([
      prisma.order.count({ where: { ...merchantScope(req), createdAt: { gte: today } } }),
      prisma.order.groupBy({ by: ['status'], where: merchantScope(req), _count: { _all: true } }),
      prisma.cODTransaction.aggregate({
        where: { ...(merchantId ? { merchantId } : {}), status: { not: 'DISPUTED' } },
        _sum: { amountCollectedKes: true },
      }),
      prisma.order.aggregate({
        where: {
          ...merchantScope(req),
          status: { in: ['MANIFESTED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'NDR_EXCEPTION'] },
        },
        _sum: { codAmountExpectedKes: true },
      }),
      prisma.deliveryAttempt.groupBy({
        by: ['status'],
        where: merchantId ? { order: { merchantId } } : undefined,
        _count: { _all: true },
      }),
      getActiveExceptions(req),
    ]);
    const counts = new Map(statuses.map((item) => [item.status, item._count._all]));
    const successAttempts = attempts.find((item) => item.status === 'SUCCESS')?._count._all ?? 0;
    const totalAttempts = attempts.reduce((sum, item) => sum + item._count._all, 0);

    return res.json({
      kpis: {
        totalOrdersToday: ordersToday,
        pendingVerification: counts.get('PENDING_VERIFICATION') ?? 0,
        readyToPick: counts.get('READY_FOR_PICK') ?? 0,
        packed: counts.get('PACKED') ?? 0,
        outForDelivery: counts.get('OUT_FOR_DELIVERY') ?? 0,
        delivered: counts.get('DELIVERED') ?? 0,
        ndrExceptions: counts.get('NDR_EXCEPTION') ?? 0,
        totalCodCollectedKes: collectedCod._sum.amountCollectedKes ?? 0,
        totalCodPendingKes: pendingCod._sum.codAmountExpectedKes ?? 0,
        deliverySuccessRatePct: totalAttempts ? Math.round((successAttempts / totalAttempts) * 1000) / 10 : 0,
        rtoRatePct: ordersToday ? Math.round(((counts.get('RETURNED_TO_WAREHOUSE') ?? 0) / ordersToday) * 1000) / 10 : 0,
      },
      openExceptionsCount: activeExceptions.length,
      activeExceptions,
    });
  } catch (error) {
    console.error('Control tower query failed', { requestId: req.requestId, error });
    return res.status(503).json({ error: 'Control tower service unavailable', requestId: req.requestId });
  }
});

controlTowerRouter.get('/exceptions', async (req: Request, res: Response) => {
  try {
    return res.json(await getActiveExceptions(req));
  } catch (error) {
    console.error('Exception query failed', { requestId: req.requestId, error });
    return res.status(503).json({ error: 'Exception service unavailable', requestId: req.requestId });
  }
});