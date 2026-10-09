import { Request, Response, Router } from 'express';
import { prisma } from '@shipit/database';

export const trackingRouter = Router();

export function publicFailureDetail(reason: string | null): string | undefined {
  if (!reason) return undefined;
  switch (reason) {
    case 'CUSTOMER_UNREACHABLE':
      return 'We could not reach you to complete this delivery attempt.';
    case 'WRONG_LOCATION':
      return 'We need help confirming the delivery location.';
    case 'RESCHEDULE_REQUESTED':
      return 'A new delivery time has been requested.';
    case 'REFUSED_DELIVERY':
      return 'Delivery was declined.';
    default:
      return 'Delivery could not be completed on this attempt.';
  }
}

trackingRouter.get('/tracking/:trackingNumber', async (req: Request, res: Response) => {
  try {
    const waybill = await prisma.waybill.findUnique({
      where: { trackingNumber: req.params.trackingNumber },
      include: {
        order: {
          include: {
            manifest: { select: { dispatchedAt: true } },
            deliveryAttempts: {
              orderBy: { attemptTimestamp: 'asc' },
              select: { status: true, failureReason: true, attemptTimestamp: true },
            },
            ndrCases: { select: { status: true, createdAt: true, closedAt: true } },
            returns: { select: { returnNumber: true, status: true, initiatedAt: true, receivedAt: true, inspectedAt: true } },
          },
        },
      },
    });
    if (!waybill) return res.status(404).json({ error: 'Tracking number not found' });

    const order = waybill.order;
    const timeline = [
      { status: 'ORDER_RECEIVED', occurredAt: order.createdAt.toISOString() },
      ...(order.manifest?.dispatchedAt ? [{ status: 'OUT_FOR_DELIVERY', occurredAt: order.manifest.dispatchedAt.toISOString() }] : []),
      ...order.deliveryAttempts.map((attempt) => ({
        status: attempt.status === 'SUCCESS' ? 'DELIVERED' : 'DELIVERY_ATTEMPT_FAILED',
        detail: publicFailureDetail(attempt.failureReason),
        occurredAt: attempt.attemptTimestamp.toISOString(),
      })),
      ...order.ndrCases.flatMap((record) => record.closedAt ? [{
        status: record.status === 'RESOLVED_FOR_REDELIVERY' ? 'REDELIVERY_SCHEDULED' : 'RETURN_TO_ORIGIN',
        occurredAt: record.closedAt.toISOString(),
      }] : []),
      ...order.returns.flatMap((record) => [
        { status: 'RETURN_INITIATED', occurredAt: record.initiatedAt.toISOString() },
        ...(record.receivedAt ? [{ status: 'RETURN_RECEIVED', occurredAt: record.receivedAt.toISOString() }] : []),
        ...(record.inspectedAt ? [{ status: 'RETURN_INSPECTED', occurredAt: record.inspectedAt.toISOString() }] : []),
      ]),
    ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    return res.json({
      trackingNumber: waybill.trackingNumber,
      orderNumber: order.orderNumber,
      status: order.status,
      destination: { county: order.county, townOrSubCounty: order.townOrSubCounty },
      preferredDeliveryDate: order.preferredDeliveryDate?.toISOString().slice(0, 10),
      timeline,
    });
  } catch (error) {
    console.error('Public tracking lookup failed', { requestId: req.requestId, error });
    return res.status(503).json({ error: 'Tracking service unavailable', requestId: req.requestId });
  }
});