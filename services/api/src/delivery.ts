import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import {
  failDeliverySchema,
  resolveNdrSchema,
  submitPodSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { enqueueDomainEvent } from './jobs.js';

const deliveryRouter = Router();

class DeliveryRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendDeliveryError(error: unknown, res: Response) {
  if (error instanceof DeliveryRequestError) return res.status(error.status).json({ error: error.message });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Delivery records changed concurrently; retry the operation' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate POD or M-Pesa receipt detected' });
  }
  console.error('Delivery database operation failed', error);
  return res.status(503).json({ error: 'Delivery service unavailable' });
}

function ensureAssignedRider(req: Request, rider: { id: string; userId: string }) {
  if (req.auth?.roles.has('RIDER') && rider.userId !== req.auth.userId) {
    throw new DeliveryRequestError(404, 'Rider not found');
  }
}

function mapNdr(record: any) {
  const order = record.order;
  const rider = record.deliveryAttempt.rider;
  return {
    id: record.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    area: `${order.townOrSubCounty} / ${order.estateOrArea}`,
    riderName: `${rider.user.firstName} ${rider.user.lastName}`,
    failureReason: record.deliveryAttempt.failureReason,
    status: record.status === 'RESOLVED_FOR_REDELIVERY' ? 'RESOLVED_RETRY' : record.status === 'RESOLVED_FOR_RTO' ? 'RESOLVED_RTO' : record.status,
    actionTakenNotes: record.resolutionNotes ?? record.deliveryAttempt.riderNotes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    closedAt: record.closedAt?.toISOString(),
  };
}

const ndrInclude = {
  order: true,
  deliveryAttempt: { include: { rider: { include: { user: true } } } },
};

deliveryRouter.get('/riders', async (_req: Request, res: Response) => {
  try {
    const records = await prisma.rider.findMany({
      include: { user: true },
      orderBy: [{ activeStatus: 'desc' }, { user: { lastName: 'asc' } }],
    });
    return res.json(records.map((rider) => ({
      id: rider.id,
      userId: rider.userId,
      name: `${rider.user.firstName} ${rider.user.lastName}`,
      phoneNumber: rider.phoneNumber,
      vehiclePlate: rider.vehicleRegPlate,
      isOnDuty: rider.activeStatus !== 'OFF_DUTY',
    })));
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

deliveryRouter.get('/riders/:id/tasks', async (req: Request, res: Response) => {
  try {
    const currentRiderRequest = req.params.id === 'me' && req.auth?.roles.has('RIDER');
    const rider = await prisma.rider.findFirst({
      where: req.auth?.roles.has('RIDER') ? { userId: req.auth.userId } : currentRiderRequest ? undefined : { id: req.params.id },
      include: { user: true },
    });
    if (!rider || (req.auth?.roles.has('RIDER') && !currentRiderRequest && rider.id !== req.params.id)) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    const manifests = await prisma.dispatchManifest.findMany({
      where: { riderId: rider.id, status: 'IN_TRANSIT' },
      include: {
        route: true,
        orders: { where: { status: { in: ['OUT_FOR_DELIVERY', 'NDR_EXCEPTION'] } }, include: { items: { include: { product: true } } } },
      },
    });
    const stops = manifests.flatMap((manifest) => manifest.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      waybillNumber: order.waybillNumber ?? undefined,
      customerName: order.customerName,
      phone: order.customerPhone,
      area: `${order.townOrSubCounty}, ${order.estateOrArea}`,
      landmark: order.landmark,
      items: order.items.map((item) => `${item.quantity}x ${item.product.name}`).join(', '),
      codAmountKes: order.codAmountExpectedKes,
      paymentMethod: order.paymentMethod,
      status: order.status === 'OUT_FOR_DELIVERY' ? 'PENDING' : 'FAILED',
    })));

    return res.json({
      rider: { id: rider.id, name: `${rider.user.firstName} ${rider.user.lastName}`, phoneNumber: rider.phoneNumber },
      stops,
      totalCodExpected: stops.filter((stop) => stop.status === 'PENDING').reduce((sum, stop) => sum + stop.codAmountKes, 0),
    });
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

deliveryRouter.post('/delivery/complete', async (req: Request, res: Response) => {
  const parsed = submitPodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid POD data', details: parsed.error.format() });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [existingOrder, rider] = await Promise.all([
        transaction.order.findFirst({
          where: { OR: [{ id: parsed.data.orderId }, { orderNumber: parsed.data.orderId }] },
          include: { manifest: true, merchant: { include: { rateCard: true } } },
        }),
        transaction.rider.findUnique({ where: { id: parsed.data.riderId } }),
      ]);
      if (!existingOrder || !rider) throw new DeliveryRequestError(404, 'Order or rider not found');
      ensureAssignedRider(req, rider);

      if (parsed.data.submissionId) {
        const previousPod = await transaction.proofOfDelivery.findUnique({
          where: { clientSubmissionId: parsed.data.submissionId },
        });
        if (previousPod) {
          const latitudeMatches = parsed.data.gpsLat === undefined
            ? previousPod.gpsLatitude === null
            : previousPod.gpsLatitude !== null && Math.abs(Number(previousPod.gpsLatitude) - parsed.data.gpsLat) < 0.0000001;
          const longitudeMatches = parsed.data.gpsLng === undefined
            ? previousPod.gpsLongitude === null
            : previousPod.gpsLongitude !== null && Math.abs(Number(previousPod.gpsLongitude) - parsed.data.gpsLng) < 0.0000001;
          const matchesSubmission = previousPod.orderId === existingOrder.id
            && previousPod.riderId === rider.id
            && previousPod.recipientName === parsed.data.recipientName
            && (previousPod.signatureImageUrl ?? undefined) === parsed.data.signatureUrl
            && (previousPod.parcelPhotoUrl ?? undefined) === parsed.data.photoUrl
            && latitudeMatches
            && longitudeMatches
            && existingOrder.status === 'DELIVERED';
          if (!matchesSubmission) {
            throw new DeliveryRequestError(409, 'Submission ID was already used for a different delivery');
          }
          if (existingOrder.paymentMethod === 'PREPAID') {
            if (parsed.data.paymentChannel !== 'PREPAID' || parsed.data.amountCollectedKes !== 0) {
              throw new DeliveryRequestError(409, 'Recorded prepaid delivery does not match this submission');
            }
          } else {
            const payment = await transaction.cODTransaction.findFirst({
              where: { orderId: existingOrder.id, status: { not: 'DISPUTED' } },
            });
            if (
              !payment ||
              payment.paymentChannel !== parsed.data.paymentChannel ||
              payment.amountCollectedKes !== parsed.data.amountCollectedKes ||
              (payment.mpesaReceiptNumber ?? '') !== (parsed.data.mpesaReceiptNumber?.trim() ?? '')
            ) {
              throw new DeliveryRequestError(409, 'Recorded payment does not match this delivery submission');
            }
          }
          return {
            order: await transaction.order.findUniqueOrThrow({
              where: { id: existingOrder.id },
              include: { waybill: true },
            }),
            replayed: true,
          };
        }
      }

      if (existingOrder.status !== 'OUT_FOR_DELIVERY' || !existingOrder.manifest || existingOrder.manifest.status !== 'IN_TRANSIT' || existingOrder.manifest.riderId !== rider.id) {
        throw new DeliveryRequestError(409, 'Order is not on this rider\'s active manifest');
      }

      const isCod = existingOrder.paymentMethod !== 'PREPAID';
      if (isCod && parsed.data.amountCollectedKes !== existingOrder.codAmountExpectedKes) {
        throw new DeliveryRequestError(409, `Collected amount must equal KES ${existingOrder.codAmountExpectedKes}`);
      }
      if (!isCod && (parsed.data.paymentChannel !== 'PREPAID' || parsed.data.amountCollectedKes !== 0)) {
        throw new DeliveryRequestError(400, 'Prepaid orders must be submitted with PREPAID and zero collected');
      }
      if (existingOrder.paymentMethod === 'COD_CASH' && parsed.data.paymentChannel !== 'CASH') {
        throw new DeliveryRequestError(400, 'This order is configured for cash COD');
      }
      if (existingOrder.paymentMethod === 'COD_MPESA' && !['MPESA_STK', 'MPESA_C2B'].includes(parsed.data.paymentChannel)) {
        throw new DeliveryRequestError(400, 'This order is configured for M-Pesa COD');
      }
      if (['MPESA_STK', 'MPESA_C2B'].includes(parsed.data.paymentChannel) && !parsed.data.mpesaReceiptNumber?.trim()) {
        throw new DeliveryRequestError(400, 'M-Pesa receipt number is required');
      }
      if (!existingOrder.merchant.rateCard) throw new DeliveryRequestError(409, 'Merchant rate card is not configured');

      const attemptNumber = await transaction.deliveryAttempt.count({ where: { orderId: existingOrder.id } }) + 1;
      await transaction.deliveryAttempt.create({
        data: {
          orderId: existingOrder.id,
          manifestId: existingOrder.manifest.id,
          riderId: rider.id,
          attemptNumber,
          status: 'SUCCESS',
          gpsLatitude: parsed.data.gpsLat,
          gpsLongitude: parsed.data.gpsLng,
        },
      });
      await transaction.proofOfDelivery.create({
        data: {
          orderId: existingOrder.id,
          clientSubmissionId: parsed.data.submissionId,
          riderId: rider.id,
          recipientName: parsed.data.recipientName,
          signatureImageUrl: parsed.data.signatureUrl,
          parcelPhotoUrl: parsed.data.photoUrl,
          gpsLatitude: parsed.data.gpsLat,
          gpsLongitude: parsed.data.gpsLng,
        },
      });

      if (isCod) {
        const receiptNumber = parsed.data.mpesaReceiptNumber?.trim() || null;
        const existingPayment = receiptNumber
          ? await transaction.cODTransaction.findFirst({
              where: { paymentChannel: parsed.data.paymentChannel, mpesaReceiptNumber: receiptNumber },
            })
          : null;
        if (parsed.data.paymentChannel === 'MPESA_STK' && (
          !existingPayment ||
          existingPayment.orderId !== existingOrder.id ||
          existingPayment.amountCollectedKes !== parsed.data.amountCollectedKes ||
          existingPayment.riderId !== rider.id
        )) {
          throw new DeliveryRequestError(409, 'M-Pesa STK payment has not been confirmed for this delivery');
        }
        if (existingPayment && (existingPayment.orderId !== existingOrder.id || existingPayment.amountCollectedKes !== parsed.data.amountCollectedKes)) {
          throw new DeliveryRequestError(409, 'M-Pesa receipt is already associated with another payment');
        }
        if (existingPayment) {
          if (existingPayment.riderId && existingPayment.riderId !== rider.id) {
            throw new DeliveryRequestError(409, 'M-Pesa payment belongs to another rider');
          }
          if (!existingPayment.riderId) {
            await transaction.cODTransaction.update({ where: { id: existingPayment.id }, data: { riderId: rider.id } });
          }
        } else {
          const otherPayment = await transaction.cODTransaction.findFirst({
            where: { orderId: existingOrder.id, status: { not: 'DISPUTED' } },
          });
          if (otherPayment) throw new DeliveryRequestError(409, 'This order already has a confirmed COD payment');
          await transaction.cODTransaction.create({
            data: {
              orderId: existingOrder.id,
              merchantId: existingOrder.merchantId,
              riderId: rider.id,
              paymentChannel: parsed.data.paymentChannel,
              amountCollectedKes: parsed.data.amountCollectedKes,
              mpesaReceiptNumber: receiptNumber,
            },
          });
        }
      }

      const balanceAggregate = await transaction.merchantLedger.aggregate({
        where: { merchantId: existingOrder.merchantId },
        _sum: { amountKes: true },
      });
      let runningBalance = balanceAggregate._sum.amountKes ?? 0;
      const ledgerEntries: Array<{ merchantId: string; orderId: string; transactionType: 'COD_CREDIT' | 'FULFILLMENT_FEE_DEBIT' | 'DELIVERY_FEE_DEBIT' | 'COD_COMMISSION_DEBIT'; amountKes: number; runningBalanceKes: number; description: string }> = [];
      if (isCod) {
        const existingCredit = await transaction.merchantLedger.findFirst({
          where: { orderId: existingOrder.id, transactionType: 'COD_CREDIT' },
        });
        if (!existingCredit) {
          runningBalance += parsed.data.amountCollectedKes;
          ledgerEntries.push({
            merchantId: existingOrder.merchantId,
            orderId: existingOrder.id,
            transactionType: 'COD_CREDIT',
            amountKes: parsed.data.amountCollectedKes,
            runningBalanceKes: runningBalance,
            description: `COD collected for ${existingOrder.orderNumber}`,
          });
        }
      }

      const fees: Array<{ transactionType: 'FULFILLMENT_FEE_DEBIT' | 'DELIVERY_FEE_DEBIT' | 'COD_COMMISSION_DEBIT'; amountKes: number; description: string }> = [
        { transactionType: 'FULFILLMENT_FEE_DEBIT' as const, amountKes: -existingOrder.merchant.rateCard.pickPackBaseFeeKes, description: `Pick and pack fee for ${existingOrder.orderNumber}` },
        {
          transactionType: 'DELIVERY_FEE_DEBIT' as const,
          amountKes: -(existingOrder.county.toLocaleLowerCase() === 'nairobi'
            ? existingOrder.merchant.rateCard.deliveryIntraNairobiKes
            : existingOrder.merchant.rateCard.deliveryUpcountryKes),
          description: `Delivery rate-card fee for ${existingOrder.orderNumber}`,
        },
      ];
      if (isCod) {
        const commission = Math.max(
          existingOrder.merchant.rateCard.codCommissionMinKes,
          Math.round(parsed.data.amountCollectedKes * existingOrder.merchant.rateCard.codCommissionBasisPoints / 10000),
        );
        fees.push({ transactionType: 'COD_COMMISSION_DEBIT', amountKes: -commission, description: `COD commission for ${existingOrder.orderNumber}` });
      }
      for (const fee of fees) {
        if (fee.amountKes === 0) continue;
        runningBalance += fee.amountKes;
        ledgerEntries.push({
          merchantId: existingOrder.merchantId,
          orderId: existingOrder.id,
          transactionType: fee.transactionType,
          amountKes: fee.amountKes,
          runningBalanceKes: runningBalance,
          description: fee.description,
        });
      }
      await transaction.merchantLedger.createMany({ data: ledgerEntries });
      await transaction.order.update({ where: { id: existingOrder.id }, data: { status: 'DELIVERED' } });
      return {
        order: await transaction.order.findUniqueOrThrow({
          where: { id: existingOrder.id },
          include: { waybill: true },
        }),
        replayed: false,
      };
    }, { isolationLevel: 'Serializable' });
    return res.json({
      success: true,
      replayed: result.replayed,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        waybillNumber: result.order.waybill?.trackingNumber,
      },
    });
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

deliveryRouter.post('/delivery/fail', async (req: Request, res: Response) => {
  const parsed = failDeliverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [order, rider] = await Promise.all([
        transaction.order.findFirst({
          where: { OR: [{ id: parsed.data.orderId }, { orderNumber: parsed.data.orderId }] },
          include: { manifest: true },
        }),
        transaction.rider.findUnique({ where: { id: parsed.data.riderId }, include: { user: true } }),
      ]);
      if (!order || !rider) throw new DeliveryRequestError(404, 'Order or rider not found');
      ensureAssignedRider(req, rider);
      if (order.status !== 'OUT_FOR_DELIVERY' || !order.manifest || order.manifest.status !== 'IN_TRANSIT' || order.manifest.riderId !== rider.id) {
        throw new DeliveryRequestError(409, 'Order is not on this rider\'s active manifest');
      }

      const attemptNumber = await transaction.deliveryAttempt.count({ where: { orderId: order.id } }) + 1;
      const attempt = await transaction.deliveryAttempt.create({
        data: {
          orderId: order.id,
          manifestId: order.manifest.id,
          riderId: rider.id,
          attemptNumber,
          status: 'FAILED',
          failureReason: parsed.data.failureReason,
          rescheduleDate: parsed.data.rescheduleDate ? new Date(parsed.data.rescheduleDate) : null,
          riderNotes: parsed.data.notes,
          gpsLatitude: parsed.data.gpsLat,
          gpsLongitude: parsed.data.gpsLng,
        },
      });
      await transaction.order.update({ where: { id: order.id }, data: { status: 'NDR_EXCEPTION' } });
      const ndrCase = await transaction.nDRCase.create({
        data: { orderId: order.id, deliveryAttemptId: attempt.id },
        include: ndrInclude,
      });
      return ndrCase;
    }, { isolationLevel: 'Serializable' });
    void enqueueDomainEvent({
      type: 'ndr.created',
      entityId: result.id,
      merchantId: result.order.merchantId,
      actorUserId: req.auth!.userId,
      payload: { orderId: result.orderId, failureReason: result.deliveryAttempt.failureReason },
    }).catch((error: unknown) => console.error('Could not enqueue NDR alert', error));
    return res.status(201).json({ success: true, ndrCase: mapNdr(result) });
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

deliveryRouter.get('/ndr', async (_req: Request, res: Response) => {
  try {
    const cases = await prisma.nDRCase.findMany({ include: ndrInclude, orderBy: { createdAt: 'desc' }, take: 500 });
    return res.json(cases.map(mapNdr));
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

deliveryRouter.post('/ndr/:id/resolve', async (req: Request, res: Response) => {
  const parsed = resolveNdrSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.nDRCase.findUnique({ where: { id: req.params.id } });
      if (!current) throw new DeliveryRequestError(404, 'NDR case not found');
      if (!['OPEN', 'ESCALATED'].includes(current.status)) throw new DeliveryRequestError(409, 'NDR case is already resolved');

      const resolved = await transaction.nDRCase.update({
        where: { id: current.id },
        data: {
          status: parsed.data.resolution === 'RETRY' ? 'RESOLVED_FOR_REDELIVERY' : 'RESOLVED_FOR_RTO',
          assignedAgentId: req.auth!.userId,
          resolutionNotes: parsed.data.notes,
          closedAt: new Date(),
        },
        include: ndrInclude,
      });
      const order = await transaction.order.update({
        where: { id: current.orderId },
        data: { status: parsed.data.resolution === 'RETRY' ? 'OUT_FOR_DELIVERY' : 'RETURN_IN_TRANSIT' },
        include: { items: true },
      });
      const returnRecord = parsed.data.resolution === 'RTO'
        ? await transaction.returnRecord.create({
            data: {
              returnNumber: `RTN-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
              orderId: order.id,
              merchantId: order.merchantId,
              returnType: 'IMMEDIATE_RTO',
              status: 'IN_TRANSIT',
              reason: `Return to origin after NDR ${current.id}`,
              items: { create: order.items.map((item) => ({ productId: item.productId, expectedUnits: item.quantity })) },
            },
          })
        : null;
      return { resolved, returnRecord };
    }, { isolationLevel: 'Serializable' });
    if (result.returnRecord) {
      void enqueueDomainEvent({
        type: 'return.initiated',
        entityId: result.returnRecord.id,
        merchantId: result.returnRecord.merchantId,
        actorUserId: req.auth!.userId,
        payload: { orderId: result.returnRecord.orderId, ndrCaseId: result.resolved.id },
      }).catch((error: unknown) => console.error('Could not enqueue RTO event', error));
    }
    void enqueueDomainEvent({
      type: `ndr.resolved.${parsed.data.resolution.toLowerCase()}`,
      entityId: result.resolved.id,
      actorUserId: req.auth!.userId,
      payload: { orderId: result.resolved.orderId },
    }).catch((error: unknown) => console.error('Could not enqueue NDR resolution event', error));
    return res.json({
      success: true,
      ndrCase: mapNdr(result.resolved),
      return: result.returnRecord,
    });
  } catch (error) {
    return sendDeliveryError(error, res);
  }
});

export { deliveryRouter };
