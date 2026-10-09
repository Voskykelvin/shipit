import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import {
  approveRiderShiftVarianceSchema,
  approveSettlementSchema,
  createSettlementSchema,
  markSettlementPaidSchema,
  riderShiftCloseoutSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';

const financeRouter = Router();

class FinanceRequestError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

function sendFinanceError(error: unknown, res: Response) {
  if (error instanceof FinanceRequestError) {
    return res.status(error.status).json({ error: error.message, ...error.details });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    return res.status(409).json({ error: 'Finance records changed concurrently; retry the operation' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    return res.status(409).json({ error: 'Settlement already exists or ledger entries are already assigned' });
  }
  console.error('Finance database operation failed', error);
  return res.status(503).json({ error: 'Finance service unavailable' });
}

function dayRange(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function mapShift(shift: any) {
  return {
    id: shift.id,
    riderId: shift.riderId,
    riderName: `${shift.rider.user.firstName} ${shift.rider.user.lastName}`,
    shiftDate: shift.shiftDate.toISOString().slice(0, 10),
    expectedCodKes: shift.totalCodExpectedKes,
    mpesaCollectedKes: shift.mpesaCollectedKes,
    expectedCashKes: shift.cashExpectedKes,
    cashHandedInKes: shift.cashHandedInKes,
    varianceKes: shift.varianceKes,
    isReconciled: shift.isReconciled,
    supervisorApprovedBy: shift.supervisorApprovedUserId ?? undefined,
    varianceNotes: shift.varianceReasonNotes ?? undefined,
    closedAt: shift.closingTimestamp?.toISOString(),
  };
}

function mapLedgerEntry(entry: any) {
  const type = entry.transactionType === 'RETURN_PENALTY_DEBIT'
    ? 'RETURN_FEE_DEBIT'
    : entry.transactionType === 'ADJUSTMENT'
      ? 'MANUAL_ADJUSTMENT'
      : entry.transactionType;
  return {
    id: entry.id,
    merchantId: entry.merchantId,
    orderId: entry.orderId ?? undefined,
    type,
    amountKes: entry.amountKes,
    runningBalanceKes: entry.runningBalanceKes,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}

function mapSettlement(settlement: any) {
  return {
    id: settlement.id,
    settlementNumber: settlement.settlementNumber,
    merchantId: settlement.merchantId,
    grossCodCollectedKes: settlement.grossCodKes,
    totalFeesDeductedKes: settlement.deductedFeesKes,
    netPayoutKes: settlement.netPayoutKes,
    status: settlement.status === 'PAID' ? 'DISBURSED' : settlement.status,
    payoutReference: settlement.payoutReference ?? undefined,
    approvedByUserId: settlement.approvedByUserId ?? undefined,
    disbursedAt: settlement.disbursedAt?.toISOString(),
    createdAt: settlement.createdAt.toISOString(),
  };
}

financeRouter.get('/finance/rider-shifts', async (_req: Request, res: Response) => {
  try {
    const shifts = await prisma.riderShift.findMany({
      include: { rider: { include: { user: true } } },
      orderBy: [{ shiftDate: 'desc' }, { rider: { user: { lastName: 'asc' } } }],
      take: 500,
    });
    return res.json(shifts.map(mapShift));
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/rider-shifts/closeout', async (req: Request, res: Response) => {
  const parsed = riderShiftCloseoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  const { start, end } = dayRange(parsed.data.shiftDate);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const rider = await transaction.rider.findUnique({
        where: { id: parsed.data.riderId },
        include: { user: true },
      });
      if (!rider) throw new FinanceRequestError(404, 'Rider not found');

      const existing = await transaction.riderShift.findUnique({
        where: { riderId_shiftDate: { riderId: rider.id, shiftDate: start } },
      });
      if (existing?.isReconciled) throw new FinanceRequestError(409, 'Rider shift is already closed');

      const activeManifests = await transaction.dispatchManifest.findMany({
        where: { riderId: rider.id, status: 'IN_TRANSIT' },
        include: { orders: { select: { id: true, status: true } } },
      });
      const hasUndeliveredOrders = activeManifests.some((manifest) =>
        manifest.orders.some((order) => !['DELIVERED', 'RETURN_IN_TRANSIT', 'RETURNED_TO_WAREHOUSE', 'CANCELLED'].includes(order.status))
      );
      if (hasUndeliveredOrders) throw new FinanceRequestError(409, 'Rider has active delivery stops or unresolved NDR cases');

      const totals = await transaction.cODTransaction.groupBy({
        by: ['paymentChannel'],
        where: { riderId: rider.id, collectedAt: { gte: start, lt: end }, status: { not: 'DISPUTED' } },
        _sum: { amountCollectedKes: true },
      });
      const mpesaCollectedKes = totals
        .filter((item) => item.paymentChannel === 'MPESA_STK' || item.paymentChannel === 'MPESA_C2B')
        .reduce((sum, item) => sum + (item._sum.amountCollectedKes ?? 0), 0);
      const cashExpectedKes = totals
        .filter((item) => item.paymentChannel === 'CASH')
        .reduce((sum, item) => sum + (item._sum.amountCollectedKes ?? 0), 0);
      const totalCodExpectedKes = mpesaCollectedKes + cashExpectedKes;
      const varianceKes = parsed.data.cashHandedInKes - cashExpectedKes;
      const hasVariance = varianceKes !== 0;
      const hasOverrideRole = req.auth?.roles.has('SUPER_ADMIN') || req.auth?.roles.has('OPERATIONS_MANAGER');
      if (hasVariance && !hasOverrideRole) {
        const draftData = {
          totalCodExpectedKes,
          mpesaCollectedKes,
          cashExpectedKes,
          cashHandedInKes: parsed.data.cashHandedInKes,
          varianceKes,
          isReconciled: false,
          closingTimestamp: null,
          supervisorApprovedUserId: null,
          varianceReasonNotes: parsed.data.varianceNotes,
        };
        const pendingShift = existing
          ? await transaction.riderShift.update({ where: { id: existing.id }, data: draftData, include: { rider: { include: { user: true } } } })
          : await transaction.riderShift.create({
              data: { riderId: rider.id, shiftDate: start, ...draftData },
              include: { rider: { include: { user: true } } },
            });
        return { blocked: true as const, shift: pendingShift, varianceKes };
      }
      if (hasVariance && !parsed.data.varianceNotes?.trim()) {
        throw new FinanceRequestError(400, 'A reason is required when approving a cash variance');
      }

      const data = {
        totalCodExpectedKes,
        mpesaCollectedKes,
        cashExpectedKes,
        cashHandedInKes: parsed.data.cashHandedInKes,
        varianceKes,
        isReconciled: true,
        closingTimestamp: new Date(),
        supervisorApprovedUserId: hasVariance ? req.auth!.userId : null,
        varianceReasonNotes: hasVariance ? parsed.data.varianceNotes : null,
      };
      const saved = existing
        ? await transaction.riderShift.update({ where: { id: existing.id }, data, include: { rider: { include: { user: true } } } })
        : await transaction.riderShift.create({
            data: { riderId: rider.id, shiftDate: start, ...data },
            include: { rider: { include: { user: true } } },
          });
      await transaction.cODTransaction.updateMany({
        where: { riderId: rider.id, collectedAt: { gte: start, lt: end }, status: 'PENDING_SETTLEMENT' },
        data: { status: 'RECONCILED' },
      });
      await transaction.rider.update({ where: { id: rider.id }, data: { currentCashHeldKes: 0, activeStatus: 'OFF_DUTY' } });
      await transaction.dispatchManifest.updateMany({
        where: { riderId: rider.id, status: 'IN_TRANSIT' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      return { blocked: false as const, shift: saved };
    }, { isolationLevel: 'Serializable' });
    if (result.blocked) {
      return res.status(409).json({
        error: 'CASH_VARIANCE_BLOCKED',
        message: `Shift has cash variance of KES ${result.varianceKes}. Manager approval required to close shift.`,
        varianceKes: result.varianceKes,
        shift: mapShift(result.shift),
      });
    }
    return res.json({ success: true, shift: mapShift(result.shift) });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/rider-shifts/:id/approve-variance', async (req: Request, res: Response) => {
  const parsed = approveRiderShiftVarianceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const shift = await prisma.$transaction(async (transaction) => {
      const current = await transaction.riderShift.findUnique({
        where: { id: req.params.id },
        include: { rider: { include: { user: true } } },
      });
      if (!current) throw new FinanceRequestError(404, 'Rider shift not found');
      if (current.isReconciled || current.closingTimestamp) {
        throw new FinanceRequestError(409, 'Rider shift has already been reconciled');
      }
      if (current.varianceKes === 0) {
        throw new FinanceRequestError(409, 'Rider shift does not have a cash variance to approve');
      }

      const { start, end } = dayRange(current.shiftDate.toISOString().slice(0, 10));
      const activeManifests = await transaction.dispatchManifest.findMany({
        where: { riderId: current.riderId, status: 'IN_TRANSIT' },
        include: { orders: { select: { status: true } } },
      });
      const hasUndeliveredOrders = activeManifests.some((manifest) =>
        manifest.orders.some((order) => !['DELIVERED', 'RETURN_IN_TRANSIT', 'RETURNED_TO_WAREHOUSE', 'CANCELLED'].includes(order.status))
      );
      if (hasUndeliveredOrders) {
        throw new FinanceRequestError(409, 'Rider has active delivery stops or unresolved NDR cases');
      }

      const totals = await transaction.cODTransaction.groupBy({
        by: ['paymentChannel'],
        where: { riderId: current.riderId, collectedAt: { gte: start, lt: end }, status: { not: 'DISPUTED' } },
        _sum: { amountCollectedKes: true },
      });
      const mpesaCollectedKes = totals
        .filter((item) => item.paymentChannel === 'MPESA_STK' || item.paymentChannel === 'MPESA_C2B')
        .reduce((sum, item) => sum + (item._sum.amountCollectedKes ?? 0), 0);
      const cashExpectedKes = totals
        .filter((item) => item.paymentChannel === 'CASH')
        .reduce((sum, item) => sum + (item._sum.amountCollectedKes ?? 0), 0);
      const totalCodExpectedKes = mpesaCollectedKes + cashExpectedKes;
      const currentVarianceKes = current.cashHandedInKes - cashExpectedKes;
      if (
        totalCodExpectedKes !== current.totalCodExpectedKes ||
        mpesaCollectedKes !== current.mpesaCollectedKes ||
        cashExpectedKes !== current.cashExpectedKes ||
        currentVarianceKes !== current.varianceKes
      ) {
        throw new FinanceRequestError(409, 'COD records changed after closeout; resubmit the rider shift for reconciliation');
      }

      const approvalNote = `Supervisor approval: ${parsed.data.approvalNotes}`;
      const saved = await transaction.riderShift.update({
        where: { id: current.id },
        data: {
          isReconciled: true,
          closingTimestamp: new Date(),
          supervisorApprovedUserId: req.auth!.userId,
          varianceReasonNotes: [current.varianceReasonNotes, approvalNote].filter(Boolean).join('\n'),
        },
        include: { rider: { include: { user: true } } },
      });
      await transaction.cODTransaction.updateMany({
        where: { riderId: current.riderId, collectedAt: { gte: start, lt: end }, status: 'PENDING_SETTLEMENT' },
        data: { status: 'RECONCILED' },
      });
      await transaction.rider.update({
        where: { id: current.riderId },
        data: { currentCashHeldKes: 0, activeStatus: 'OFF_DUTY' },
      });
      await transaction.dispatchManifest.updateMany({
        where: { riderId: current.riderId, status: 'IN_TRANSIT' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      return saved;
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, shift: mapShift(shift) });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.get('/finance/ledgers', async (req: Request, res: Response) => {
  const requestedMerchantId = typeof req.query.merchantId === 'string' ? req.query.merchantId : undefined;
  const merchantId = req.auth?.merchantId ?? requestedMerchantId;
  if (requestedMerchantId && !canAccessMerchant(req, requestedMerchantId)) {
    return res.status(403).json({ error: 'Cannot access another merchant' });
  }

  try {
    const entries = await prisma.merchantLedger.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return res.json(entries.map(mapLedgerEntry));
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.get('/finance/settlements', async (req: Request, res: Response) => {
  try {
    const settlements = await prisma.merchantSettlement.findMany({
      where: req.auth?.merchantId ? { merchantId: req.auth.merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return res.json(settlements.map(mapSettlement));
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/settlements', async (req: Request, res: Response) => {
  const parsed = createSettlementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
  if (!canAccessMerchant(req, parsed.data.merchantId)) {
    return res.status(403).json({ error: 'Cannot request settlement for another merchant' });
  }
  const periodStart = new Date(`${parsed.data.periodStart}T00:00:00.000Z`);
  const periodEnd = new Date(`${parsed.data.periodEnd}T00:00:00.000Z`);
  const periodEndExclusive = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);

  try {
    const settlement = await prisma.$transaction(async (transaction) => {
      const merchant = await transaction.merchant.findUnique({ where: { id: parsed.data.merchantId } });
      if (!merchant || merchant.status !== 'ACTIVE') throw new FinanceRequestError(404, 'Active merchant not found');

      const entries = await transaction.merchantLedger.findMany({
        where: {
          merchantId: merchant.id,
          createdAt: { gte: periodStart, lt: periodEndExclusive },
          settlementLinks: { none: {} },
          OR: [
            {
              transactionType: 'COD_CREDIT',
              order: { is: { codTransactions: { some: { status: 'RECONCILED' } } } },
            },
            {
              transactionType: { in: ['FULFILLMENT_FEE_DEBIT', 'STORAGE_FEE_DEBIT', 'DELIVERY_FEE_DEBIT', 'COD_COMMISSION_DEBIT', 'RETURN_PENALTY_DEBIT'] },
              order: { is: {
                OR: [
                  { paymentMethod: 'PREPAID' },
                  { codTransactions: { some: { status: 'RECONCILED' } } },
                ],
              } },
            },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (entries.length === 0) throw new FinanceRequestError(409, 'No unreconciled ledger activity is available for this period');

      const grossCodKes = entries.filter((entry) => entry.transactionType === 'COD_CREDIT').reduce((sum, entry) => sum + entry.amountKes, 0);
      const deductedFeesKes = entries.filter((entry) => entry.amountKes < 0).reduce((sum, entry) => sum - entry.amountKes, 0);
      const netPayoutKes = grossCodKes - deductedFeesKes;
      if (netPayoutKes <= 0) throw new FinanceRequestError(409, 'Settlement net payout must be greater than zero');

      const created = await transaction.merchantSettlement.create({
        data: {
          merchantId: merchant.id,
          settlementNumber: `SET-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
          periodStart,
          periodEnd,
          grossCodKes,
          deductedFeesKes,
          netPayoutKes,
          ledgerEntries: { create: entries.map((entry) => ({ ledgerEntryId: entry.id })) },
        },
      });
      return created;
    }, { isolationLevel: 'Serializable' });
    return res.status(201).json(mapSettlement(settlement));
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/settlements/approve', async (req: Request, res: Response) => {
  const parsed = approveSettlementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const settlement = await prisma.merchantSettlement.findUnique({ where: { id: parsed.data.settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    if (settlement.status !== 'DRAFT') return res.status(409).json({ error: 'Only draft settlements can be approved' });
    const updated = await prisma.merchantSettlement.update({
      where: { id: settlement.id },
      data: { status: 'APPROVED', approvedByUserId: req.auth!.userId },
    });
    return res.json({ success: true, settlement: mapSettlement(updated) });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/settlements/:id/paid', async (req: Request, res: Response) => {
  const parsed = markSettlementPaidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const settlement = await transaction.merchantSettlement.findUnique({ where: { id: req.params.id } });
      if (!settlement) throw new FinanceRequestError(404, 'Settlement not found');
      if (!canAccessMerchant(req, settlement.merchantId)) throw new FinanceRequestError(404, 'Settlement not found');
      if (settlement.status !== 'APPROVED') throw new FinanceRequestError(409, 'Only approved settlements can be marked paid');

      const currentBalance = await transaction.merchantLedger.aggregate({
        where: { merchantId: settlement.merchantId },
        _sum: { amountKes: true },
      });
      const paid = await transaction.merchantSettlement.update({
        where: { id: settlement.id },
        data: { status: 'PAID', payoutReference: parsed.data.payoutReference, disbursedAt: new Date() },
      });
      await transaction.merchantLedger.create({
        data: {
          merchantId: settlement.merchantId,
          transactionType: 'SETTLEMENT_PAYOUT_DEBIT',
          amountKes: -settlement.netPayoutKes,
          runningBalanceKes: (currentBalance._sum.amountKes ?? 0) - settlement.netPayoutKes,
          description: `Settlement ${settlement.settlementNumber} paid (${parsed.data.payoutReference})`,
        },
      });
      return paid;
    }, { isolationLevel: 'Serializable' });
    return res.json({ success: true, settlement: mapSettlement(updated) });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.get('/finance/mpesa/stats', async (req: Request, res: Response) => {
  try {
    const merchantFilter = req.auth?.merchantId ? { merchantId: req.auth.merchantId } : {};

    const [stkStats, codStats, b2cStats] = await Promise.all([
      prisma.mpesaStkRequest.findMany({
        where: merchantFilter,
        select: { status: true, amountKes: true },
      }),
      prisma.cODTransaction.findMany({
        where: { ...merchantFilter, paymentChannel: { in: ['MPESA_STK', 'MPESA_C2B'] } },
        select: { paymentChannel: true, amountCollectedKes: true, status: true },
      }),
      prisma.mpesaB2CPayout.findMany({
        select: { status: true, settlement: { select: { netPayoutKes: true, merchantId: true } } },
      }),
    ]);

    const totalStkCount = stkStats.length;
    const successfulStk = stkStats.filter((s) => s.status === 'SUCCEEDED');
    const failedStk = stkStats.filter((s) => s.status === 'FAILED');
    const initiatedStk = stkStats.filter((s) => s.status === 'INITIATED');
    const totalStkVolumeKes = successfulStk.reduce((acc, curr) => acc + curr.amountKes, 0);

    const c2bTransactions = codStats.filter((c) => c.paymentChannel === 'MPESA_C2B');
    const totalC2bVolumeKes = c2bTransactions.reduce((acc, curr) => acc + curr.amountCollectedKes, 0);

    const relevantB2c = req.auth?.merchantId
      ? b2cStats.filter((b) => b.settlement.merchantId === req.auth!.merchantId)
      : b2cStats;
    const successfulB2c = relevantB2c.filter((b) => b.status === 'SUCCEEDED');
    const totalB2cVolumeKes = successfulB2c.reduce((acc, curr) => acc + curr.settlement.netPayoutKes, 0);

    return res.json({
      stk: {
        totalRequests: totalStkCount,
        succeeded: successfulStk.length,
        failed: failedStk.length,
        pending: initiatedStk.length,
        totalVolumeKes: totalStkVolumeKes,
        successRatePercent: totalStkCount > 0 ? Math.round((successfulStk.length / totalStkCount) * 100) : 100,
      },
      c2b: {
        totalTransactions: c2bTransactions.length,
        totalVolumeKes: totalC2bVolumeKes,
      },
      b2c: {
        totalPayouts: relevantB2c.length,
        succeeded: successfulB2c.length,
        totalVolumeKes: totalB2cVolumeKes,
      },
      totalMobileMoneyVolumeKes: totalStkVolumeKes + totalC2bVolumeKes,
    });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.get('/finance/mpesa/transactions', async (req: Request, res: Response) => {
  try {
    const merchantFilter = req.auth?.merchantId ? { merchantId: req.auth.merchantId } : {};

    const [stkRequests, codTransactions, b2cPayouts] = await Promise.all([
      prisma.mpesaStkRequest.findMany({
        where: merchantFilter,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, customerName: true, customerPhone: true } },
          merchant: { select: { name: true } },
          rider: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.cODTransaction.findMany({
        where: { ...merchantFilter, paymentChannel: { in: ['MPESA_STK', 'MPESA_C2B'] } },
        take: 50,
        orderBy: { collectedAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, customerName: true, customerPhone: true } },
          merchant: { select: { name: true } },
          rider: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.mpesaB2CPayout.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          settlement: {
            select: {
              settlementNumber: true,
              netPayoutKes: true,
              merchantId: true,
              merchant: { select: { name: true, mpesaB2cPhone: true } },
            },
          },
        },
      }),
    ]);

    const formattedStk = stkRequests.map((stk) => ({
      id: stk.id,
      channel: 'MPESA_STK',
      direction: 'INBOUND',
      status: stk.status,
      receiptNumber: stk.mpesaReceiptNumber ?? stk.checkoutRequestId ?? 'PENDING',
      amountKes: stk.amountKes,
      orderNumber: stk.order.orderNumber,
      customerName: stk.order.customerName,
      customerPhone: stk.phoneNumber,
      merchantName: stk.merchant.name,
      riderName: stk.rider ? `${stk.rider.user.firstName} ${stk.rider.user.lastName}` : 'N/A',
      resultDesc: stk.resultDescription,
      timestamp: stk.createdAt.toISOString(),
    }));

    const formattedCod = codTransactions.map((cod) => ({
      id: cod.id,
      channel: cod.paymentChannel,
      direction: 'INBOUND',
      status: cod.status === 'PENDING_SETTLEMENT' ? 'SUCCEEDED' : cod.status,
      receiptNumber: cod.mpesaReceiptNumber ?? 'MANUAL_C2B',
      amountKes: cod.amountCollectedKes,
      orderNumber: cod.order.orderNumber,
      customerName: cod.order.customerName,
      customerPhone: cod.order.customerPhone,
      merchantName: cod.merchant.name,
      riderName: cod.rider ? `${cod.rider.user.firstName} ${cod.rider.user.lastName}` : 'N/A',
      resultDesc: 'Reconciled to order ledger',
      timestamp: cod.collectedAt.toISOString(),
    }));

    const formattedB2c = b2cPayouts
      .filter((b) => !req.auth?.merchantId || b.settlement.merchantId === req.auth.merchantId)
      .map((b) => ({
        id: b.id,
        channel: 'MPESA_B2C',
        direction: 'OUTBOUND',
        status: b.status,
        receiptNumber: b.payoutReference ?? b.conversationId ?? 'PENDING',
        amountKes: b.settlement.netPayoutKes,
        orderNumber: b.settlement.settlementNumber,
        customerName: b.settlement.merchant.name,
        customerPhone: b.settlement.merchant.mpesaB2cPhone ?? 'N/A',
        merchantName: b.settlement.merchant.name,
        riderName: 'Finance Gateway',
        resultDesc: b.resultDescription ?? 'Settlement payout',
        timestamp: b.createdAt.toISOString(),
      }));

    const all = [...formattedStk, ...formattedCod, ...formattedB2c].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return res.json({ transactions: all });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

financeRouter.post('/finance/mpesa/reconcile-query', async (req: Request, res: Response) => {
  const { orderNumber, receiptNumber, amountKes, paymentChannel } = req.body ?? {};
  if (!orderNumber || !receiptNumber || !amountKes) {
    return res.status(400).json({ error: 'orderNumber, receiptNumber, and amountKes are required.' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: String(orderNumber).trim() },
      include: { manifest: true },
    });

    if (!order) {
      return res.status(404).json({ error: `Order #${orderNumber} not found.` });
    }

    if (!canAccessMerchant(req, order.merchantId)) {
      return res.status(403).json({ error: 'Access denied to this merchant order.' });
    }

    const receipt = String(receiptNumber).trim().toUpperCase();
    const existing = await prisma.cODTransaction.findFirst({
      where: { mpesaReceiptNumber: receipt },
    });

    if (existing) {
      return res.status(409).json({
        error: `M-Pesa receipt ${receipt} is already recorded for an order.`,
      });
    }

    const channel = paymentChannel === 'MPESA_STK' ? 'MPESA_STK' : 'MPESA_C2B';
    const amount = Number(amountKes);

    const transaction = await prisma.cODTransaction.create({
      data: {
        orderId: order.id,
        merchantId: order.merchantId,
        riderId: order.manifest?.riderId ?? null,
        paymentChannel: channel,
        amountCollectedKes: amount,
        mpesaReceiptNumber: receipt,
        status: 'PENDING_SETTLEMENT',
      },
    });

    // Credit merchant ledger
    const balance = await prisma.merchantLedger.aggregate({
      where: { merchantId: order.merchantId },
      _sum: { amountKes: true },
    });

    await prisma.merchantLedger.create({
      data: {
        merchantId: order.merchantId,
        orderId: order.id,
        transactionType: 'COD_CREDIT',
        amountKes: amount,
        runningBalanceKes: (balance._sum.amountKes ?? 0) + amount,
        description: `Manual M-Pesa ${channel} reconciliation for order ${order.orderNumber} (Receipt: ${receipt})`,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Receipt ${receipt} successfully reconciled to order #${order.orderNumber} for KES ${amount.toLocaleString()}.`,
      transaction,
    });
  } catch (error) {
    return sendFinanceError(error, res);
  }
});

export { financeRouter };

