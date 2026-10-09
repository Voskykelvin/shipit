import { timingSafeEqual } from 'node:crypto';
import { Request, Response, Router } from 'express';
import {
  mpesaC2bCallbackSchema,
  mpesaB2cResultSchema,
  mpesaStkCallbackSchema,
  mpesaStkPushSchema,
} from '@shipit/validation';
import { prisma } from '@shipit/database';
import { canAccessMerchant } from './auth.js';
import { enqueueDomainEvent } from './jobs.js';
import { isMatchingC2bReplay } from './mpesaHelpers.js';

export const mpesaPaymentRouter = Router();
export const mpesaWebhookRouter = Router();

class MpesaRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let accessToken: { value: string; expiresAt: number } | undefined;

function mpesaBaseUrl() {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function mpesaTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}${values.get('month')}${values.get('day')}${values.get('hour')}${values.get('minute')}${values.get('second')}`;
}

function requiredOAuthConfig() {
  const config = {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new MpesaRequestError(503, 'M-Pesa integration is not configured');
  }
  return config as Record<keyof typeof config, string>;
}

function requiredMpesaConfig() {
  const oauth = requiredOAuthConfig();
  const config = {
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    callbackToken: process.env.MPESA_CALLBACK_TOKEN,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new MpesaRequestError(503, 'M-Pesa integration is not configured');
  }
  return { ...oauth, ...config } as Record<keyof typeof config | keyof typeof oauth, string>;
}

function requiredB2cConfig() {
  const oauth = requiredOAuthConfig();
  const base = {
    shortcode: process.env.MPESA_SHORTCODE,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    callbackToken: process.env.MPESA_CALLBACK_TOKEN,
  };
  const initiatorName = process.env.MPESA_INITIATOR_NAME;
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL;
  if (Object.values(base).some((value) => !value) || !initiatorName || !securityCredential) {
    throw new MpesaRequestError(503, 'M-Pesa B2C payout is not configured');
  }
  return { ...oauth, ...base, initiatorName, securityCredential } as Record<string, string>;
}

async function getAccessToken() {
  const config = requiredOAuthConfig();
  if (accessToken && accessToken.expiresAt > Date.now() + 30000) return accessToken.value;

  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const response = await fetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new MpesaRequestError(502, 'Could not authenticate with M-Pesa');
  const result = await response.json() as { access_token?: string; expires_in?: string };
  if (!result.access_token) throw new MpesaRequestError(502, 'M-Pesa returned an invalid access token response');

  accessToken = {
    value: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000,
  };
  return accessToken.value;
}

function callbackTokenIsValid(req: Request) {
  const expected = process.env.MPESA_CALLBACK_TOKEN;
  const supplied = typeof req.query.token === 'string' ? req.query.token : '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function enqueuePaymentEvent(event: { type: string; entityId: string; merchantId: string; payload: Record<string, unknown> }) {
  void enqueueDomainEvent(event).catch((error: unknown) => console.error('Could not enqueue M-Pesa event', error));
}

mpesaPaymentRouter.get('/delivery/mpesa/stk-push/:checkoutRequestId', async (req: Request, res: Response) => {
  try {
    const request = await prisma.mpesaStkRequest.findUnique({
      where: { checkoutRequestId: req.params.checkoutRequestId },
      include: { rider: { include: { user: true } } },
    });
    if (
      !request ||
      !canAccessMerchant(req, request.merchantId) ||
      (req.auth?.roles.has('RIDER') && request.rider.userId !== req.auth.userId)
    ) {
      return res.status(404).json({ error: 'M-Pesa request not found' });
    }
    return res.json({
      status: request.status,
      receiptNumber: request.status === 'SUCCEEDED' ? request.mpesaReceiptNumber : undefined,
      resultDescription: request.status === 'FAILED' ? request.resultDescription : undefined,
    });
  } catch (error) {
    console.error('Could not read M-Pesa STK status', { requestId: req.requestId, error });
    return res.status(503).json({ error: 'M-Pesa payment status is unavailable' });
  }
});

async function recordMpesaCollection(input: {
  orderId: string;
  merchantId: string;
  riderId: string | null;
  amountKes: number;
  receiptNumber: string;
  paymentChannel: 'MPESA_STK' | 'MPESA_C2B';
  stkRequestId?: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const existingPayment = await transaction.cODTransaction.findFirst({
      where: { paymentChannel: input.paymentChannel, mpesaReceiptNumber: input.receiptNumber },
    });
    if (existingPayment) {
      if (existingPayment.orderId !== input.orderId || existingPayment.amountCollectedKes !== input.amountKes) {
        throw new MpesaRequestError(409, 'M-Pesa receipt is already associated with another payment');
      }
      if (input.stkRequestId) {
        await transaction.mpesaStkRequest.update({
          where: { id: input.stkRequestId },
          data: { status: 'SUCCEEDED', mpesaReceiptNumber: input.receiptNumber, completedAt: new Date() },
        });
      }
      return { duplicate: true as const };
    }

    const confirmedOrderPayment = await transaction.cODTransaction.findFirst({
      where: { orderId: input.orderId, status: { not: 'DISPUTED' } },
    });
    if (confirmedOrderPayment) throw new MpesaRequestError(409, 'This order already has a confirmed COD payment');

    const order = await transaction.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.merchantId !== input.merchantId || order.paymentMethod !== 'COD_MPESA' ||
      order.codAmountExpectedKes !== input.amountKes || order.status === 'CANCELLED') {
      throw new MpesaRequestError(409, 'Payment no longer matches an eligible COD order');
    }

    await transaction.cODTransaction.create({
      data: {
        orderId: order.id,
        merchantId: order.merchantId,
        riderId: input.riderId,
        paymentChannel: input.paymentChannel,
        amountCollectedKes: input.amountKes,
        mpesaReceiptNumber: input.receiptNumber,
      },
    });
    const currentBalance = await transaction.merchantLedger.aggregate({
      where: { merchantId: order.merchantId },
      _sum: { amountKes: true },
    });
    await transaction.merchantLedger.create({
      data: {
        merchantId: order.merchantId,
        orderId: order.id,
        transactionType: 'COD_CREDIT',
        amountKes: input.amountKes,
        runningBalanceKes: (currentBalance._sum.amountKes ?? 0) + input.amountKes,
        description: `M-Pesa COD collected for ${order.orderNumber}`,
      },
    });

    if (input.stkRequestId) {
      await transaction.mpesaStkRequest.update({
        where: { id: input.stkRequestId },
        data: { status: 'SUCCEEDED', mpesaReceiptNumber: input.receiptNumber, completedAt: new Date() },
      });
    }
    return { duplicate: false as const };
  }, { isolationLevel: 'Serializable' });
}

  mpesaPaymentRouter.post('/delivery/mpesa/stk-push', async (req: Request, res: Response) => {
  const parsed = mpesaStkPushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });

  try {
    const config = requiredMpesaConfig();
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: parsed.data.orderId }, { orderNumber: parsed.data.orderId }] },
      include: { manifest: true },
    });
    const rider = await prisma.rider.findUnique({ where: { id: parsed.data.riderId } });
    if (!order || !rider || (req.auth?.merchantId && req.auth.merchantId !== order.merchantId)) {
      return res.status(404).json({ error: 'Order or rider not found' });
    }
    if (req.auth?.roles.has('RIDER') && rider.userId !== req.auth.userId) {
      return res.status(404).json({ error: 'Rider not found' });
    }
    if (order.paymentMethod !== 'COD_MPESA' || order.status !== 'OUT_FOR_DELIVERY' ||
      order.manifest?.status !== 'IN_TRANSIT' || order.manifest.riderId !== rider.id) {
      return res.status(409).json({ error: 'Order is not an M-Pesa COD stop assigned to this active rider' });
    }

    const confirmedPayment = await prisma.cODTransaction.findFirst({
      where: { orderId: order.id, status: { not: 'DISPUTED' } },
    });
    if (confirmedPayment) return res.status(409).json({ error: 'This order already has a confirmed COD payment' });

    const pending = await prisma.mpesaStkRequest.findFirst({
      where: { orderId: order.id, status: 'INITIATED' },
    });
    if (pending) return res.status(409).json({ error: 'An M-Pesa payment prompt is already pending' });

    const request = await prisma.mpesaStkRequest.create({
      data: {
        orderId: order.id,
        merchantId: order.merchantId,
        riderId: rider.id,
        phoneNumber: order.customerPhone,
        amountKes: order.codAmountExpectedKes,
      },
    });
    const timestamp = mpesaTimestamp();
    const response = await fetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64'),
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: order.codAmountExpectedKes,
        PartyA: order.customerPhone,
        PartyB: config.shortcode,
        PhoneNumber: order.customerPhone,
        CallBackURL: `${config.callbackUrl.replace(/\/$/, '')}/api/webhooks/mpesa/stk?token=${encodeURIComponent(config.callbackToken)}`,
        AccountReference: order.orderNumber.slice(-12),
        TransactionDesc: `ShipIt COD ${order.orderNumber}`.slice(0, 13),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };
    if (!response.ok || result.ResponseCode !== '0' || !result.CheckoutRequestID) {
      await prisma.mpesaStkRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED', resultDescription: result.errorMessage ?? result.ResponseDescription ?? 'STK Push rejected', completedAt: new Date() },
      });
      return res.status(502).json({ error: result.errorMessage ?? result.ResponseDescription ?? 'M-Pesa rejected the payment prompt' });
    }

    await prisma.mpesaStkRequest.update({
      where: { id: request.id },
      data: { merchantRequestId: result.MerchantRequestID, checkoutRequestId: result.CheckoutRequestID },
    });
    return res.status(202).json({
      success: true,
      message: 'Payment prompt sent to the customer phone',
      checkoutRequestId: result.CheckoutRequestID,
    });
  } catch (error) {
    if (error instanceof MpesaRequestError) return res.status(error.status).json({ error: error.message });
    console.error('STK Push request failed', { requestId: req.requestId, error });
    return res.status(502).json({ error: 'Could not initiate M-Pesa payment' });
  }
});

mpesaWebhookRouter.post('/webhooks/mpesa/stk', async (req: Request, res: Response) => {
  if (!callbackTokenIsValid(req)) return res.status(401).json({ error: 'Invalid callback token' });
  const parsed = mpesaStkCallbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid M-Pesa callback' });

  const callback = parsed.data.Body.stkCallback;
  try {
    const request = await prisma.mpesaStkRequest.findUnique({ where: { checkoutRequestId: callback.CheckoutRequestID } });
    if (!request) return res.status(503).json({ error: 'STK request is not available yet' });
    if (request.status === 'SUCCEEDED' || request.status === 'FAILED') {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback already processed' });
    }
    if (request.merchantRequestId && request.merchantRequestId !== callback.MerchantRequestID) {
      return res.status(400).json({ error: 'Callback request identifiers do not match' });
    }

    if (callback.ResultCode !== 0) {
      await prisma.mpesaStkRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED', resultCode: callback.ResultCode, resultDescription: callback.ResultDesc, completedAt: new Date() },
      });
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback acknowledged' });
    }

    const metadata = new Map((callback.CallbackMetadata?.Item ?? []).map((item) => [item.Name, item.Value]));
    const amountKes = Number(metadata.get('Amount'));
    const receiptNumber = metadata.get('MpesaReceiptNumber');
    if (!Number.isSafeInteger(amountKes) || typeof receiptNumber !== 'string' || !receiptNumber) {
      return res.status(400).json({ error: 'Successful callback is missing payment metadata' });
    }
    if (amountKes !== request.amountKes) {
      await prisma.mpesaStkRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED', resultCode: callback.ResultCode, resultDescription: 'Paid amount did not match order COD', completedAt: new Date() },
      });
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback acknowledged' });
    }

    await recordMpesaCollection({
      orderId: request.orderId,
      merchantId: request.merchantId,
      riderId: request.riderId,
      amountKes,
      receiptNumber,
      paymentChannel: 'MPESA_STK',
      stkRequestId: request.id,
    });
    enqueuePaymentEvent({
      type: 'payment.mpesa.stk.confirmed',
      entityId: request.id,
      merchantId: request.merchantId,
      payload: { orderId: request.orderId, receiptNumber },
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback acknowledged' });
  } catch (error) {
    console.error('STK callback processing failed', { requestId: req.requestId, error });
    return res.status(500).json({ error: 'Callback could not be processed' });
  }
});

mpesaWebhookRouter.post('/webhooks/mpesa/c2b/validation', async (req: Request, res: Response) => {
  if (!callbackTokenIsValid(req)) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid callback token' });
  const parsed = mpesaC2bCallbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid payment reference' });

  try {
    const payment = parsed.data;
    if (payment.BusinessShortCode !== undefined && process.env.MPESA_SHORTCODE &&
      String(payment.BusinessShortCode) !== process.env.MPESA_SHORTCODE) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Paybill does not match' });
    }
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderNumber: payment.BillRefNumber }, { externalReference: payment.BillRefNumber }],
        paymentMethod: 'COD_MPESA',
        status: { in: ['MANIFESTED', 'OUT_FOR_DELIVERY'] },
      },
    });
    if (!order || order.codAmountExpectedKes !== payment.TransAmount) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Order or amount does not match' });
    }
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B validation failed', { requestId: req.requestId, error });
    return res.status(200).json({ ResultCode: 1, ResultDesc: 'Validation unavailable' });
  }
});

mpesaWebhookRouter.post('/webhooks/mpesa/c2b/confirmation', async (req: Request, res: Response) => {
  if (!callbackTokenIsValid(req)) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid callback token' });
  const parsed = mpesaC2bCallbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' });

  try {
    const payment = parsed.data;
    if (payment.BusinessShortCode !== undefined && process.env.MPESA_SHORTCODE &&
      String(payment.BusinessShortCode) !== process.env.MPESA_SHORTCODE) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Paybill does not match' });
    }
    const existing = await prisma.cODTransaction.findFirst({
      where: { paymentChannel: 'MPESA_C2B', mpesaReceiptNumber: payment.TransID },
    });
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ orderNumber: payment.BillRefNumber }, { externalReference: payment.BillRefNumber }],
        paymentMethod: 'COD_MPESA',
      },
      include: { manifest: true },
    });
    if (existing) {
      if (isMatchingC2bReplay(existing, order, payment.TransAmount)) {
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
      }
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Receipt was already processed with different payment details' });
    }
    if (
      !order ||
      !['MANIFESTED', 'OUT_FOR_DELIVERY'].includes(order.status) ||
      order.codAmountExpectedKes !== payment.TransAmount
    ) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Order or amount does not match' });
    }

    await recordMpesaCollection({
      orderId: order.id,
      merchantId: order.merchantId,
      riderId: order.manifest?.riderId ?? null,
      amountKes: payment.TransAmount,
      receiptNumber: payment.TransID,
      paymentChannel: 'MPESA_C2B',
    });
    enqueuePaymentEvent({
      type: 'payment.mpesa.c2b.confirmed',
      entityId: payment.TransID,
      merchantId: order.merchantId,
      payload: { orderId: order.id, receiptNumber: payment.TransID },
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B confirmation failed', { requestId: req.requestId, error });
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Confirmation could not be processed' });
  }
});

mpesaPaymentRouter.post('/finance/settlements/:id/disburse', async (req: Request, res: Response) => {
  let payoutId: string | undefined;
  let requestAccepted = false;
  let requestSubmitted = false;
  try {
    const config = requiredB2cConfig();
    const settlement = await prisma.merchantSettlement.findUnique({
      where: { id: req.params.id },
      include: { merchant: true, mpesaB2cPayout: true },
    });
    if (!settlement || (req.auth?.merchantId && req.auth.merchantId !== settlement.merchantId)) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    if (settlement.status !== 'APPROVED') return res.status(409).json({ error: 'Only approved settlements can be disbursed' });
    if (!settlement.merchant.mpesaB2cPhone) return res.status(409).json({ error: 'Merchant has no M-Pesa B2C phone configured' });
    if (settlement.mpesaB2cPayout && settlement.mpesaB2cPayout.status !== 'FAILED') {
      return res.status(409).json({ error: 'A B2C payout has already been requested for this settlement' });
    }

    const payout = settlement.mpesaB2cPayout
      ? await prisma.mpesaB2CPayout.update({
          where: { id: settlement.mpesaB2cPayout.id },
          data: {
            status: 'INITIATED',
            conversationId: null,
            originatorConversationId: null,
            resultCode: null,
            resultDescription: null,
            payoutReference: null,
            completedAt: null,
          },
        })
      : await prisma.mpesaB2CPayout.create({ data: { settlementId: settlement.id } });
    payoutId = payout.id;

    const callbackBase = config.callbackUrl.replace(/\/$/, '');
    const callbackToken = encodeURIComponent(config.callbackToken);
    const token = await getAccessToken();
    requestSubmitted = true;
    const response = await fetch(`${mpesaBaseUrl()}/mpesa/b2c/v3/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InitiatorName: config.initiatorName,
        SecurityCredential: config.securityCredential,
        CommandID: 'BusinessPayment',
        Amount: settlement.netPayoutKes,
        PartyA: config.shortcode,
        PartyB: settlement.merchant.mpesaB2cPhone,
        Remarks: `Settlement ${settlement.settlementNumber}`,
        QueueTimeOutURL: `${callbackBase}/api/webhooks/mpesa/b2c/timeout?token=${callbackToken}`,
        ResultURL: `${callbackBase}/api/webhooks/mpesa/b2c/result?token=${callbackToken}`,
        Occasion: settlement.settlementNumber,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as {
      ConversationID?: string;
      OriginatorConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };
    if (!response.ok || result.ResponseCode !== '0' || !result.ConversationID || !result.OriginatorConversationID) {
      const description = result.errorMessage ?? result.ResponseDescription ?? 'M-Pesa rejected the B2C payout';
      await prisma.mpesaB2CPayout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', resultDescription: description, completedAt: new Date() },
      });
      return res.status(502).json({ error: description });
    }
    requestAccepted = true;

    await prisma.$transaction(async (transaction) => {
      const current = await transaction.merchantSettlement.findUnique({ where: { id: settlement.id } });
      if (!current || current.status !== 'APPROVED') throw new MpesaRequestError(409, 'Settlement state changed while submitting payout');
      await transaction.mpesaB2CPayout.update({
        where: { id: payout.id },
        data: {
          status: 'ACCEPTED',
          conversationId: result.ConversationID,
          originatorConversationId: result.OriginatorConversationID,
        },
      });
      await transaction.merchantSettlement.update({
        where: { id: current.id },
        data: { status: 'PROCESSED', payoutReference: result.OriginatorConversationID },
      });
    }, { isolationLevel: 'Serializable' });

    enqueuePaymentEvent({
      type: 'settlement.mpesa.b2c.initiated',
      entityId: settlement.id,
      merchantId: settlement.merchantId,
      payload: { payoutId: payout.id, settlementNumber: settlement.settlementNumber },
    });
    return res.status(202).json({ success: true, status: 'PROCESSED', settlementId: settlement.id });
  } catch (error) {
    if (error instanceof MpesaRequestError) return res.status(error.status).json({ error: error.message });
    if (payoutId && !requestAccepted) {
      if (requestSubmitted) {
        await prisma.$transaction([
          prisma.mpesaB2CPayout.update({
            where: { id: payoutId },
            data: { status: 'OUTCOME_UNKNOWN', resultDescription: 'Provider request submitted; callback or manual reconciliation required' },
          }),
          prisma.merchantSettlement.updateMany({
            where: { mpesaB2cPayout: { is: { id: payoutId } }, status: 'APPROVED' },
            data: { status: 'PROCESSED', payoutReference: 'PENDING_RECONCILIATION' },
          }),
        ]).catch((persistError: unknown) => console.error('Could not persist ambiguous B2C payout state', persistError));
      } else {
        await prisma.mpesaB2CPayout.update({
          where: { id: payoutId },
          data: { status: 'FAILED', resultDescription: 'B2C payout request failed before submission', completedAt: new Date() },
        }).catch(() => undefined);
      }
    }
    console.error('B2C payout initiation failed', { requestId: req.requestId, error });
    return res.status(502).json({ error: 'Could not initiate M-Pesa B2C payout' });
  }
});

async function handleB2cResult(req: Request, res: Response, timedOut: boolean) {
  if (!callbackTokenIsValid(req)) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Invalid callback token' });
  const parsed = mpesaB2cResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' });
  const result = parsed.data.Result;

  try {
    const payout = await prisma.mpesaB2CPayout.findFirst({
      where: {
        OR: [
          { conversationId: result.ConversationID },
          { originatorConversationId: result.OriginatorConversationID },
        ],
      },
      include: { settlement: true },
    });
    if (!payout) return res.status(503).json({ ResultCode: 1, ResultDesc: 'Payout request is not available yet' });
    if (payout.status === 'SUCCEEDED' || payout.status === 'FAILED') {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback already processed' });
    }

    const receipt = result.ResultParameters?.ResultParameter.find((item) => item.Key === 'TransactionReceipt')?.Value;
    if (timedOut || result.ResultCode !== 0) {
      await prisma.$transaction([
        prisma.mpesaB2CPayout.update({
          where: { id: payout.id },
          data: { status: 'FAILED', resultCode: result.ResultCode, resultDescription: result.ResultDesc, completedAt: new Date() },
        }),
        prisma.merchantSettlement.update({
          where: { id: payout.settlementId },
          data: { status: 'APPROVED', payoutReference: null },
        }),
      ]);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback acknowledged' });
    }
    if (payout.settlement.status !== 'PROCESSED') {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Settlement is not awaiting a B2C result' });
    }

    const payoutReference = String(receipt ?? result.ConversationID);
    await prisma.$transaction(async (transaction) => {
      const currentPayout = await transaction.mpesaB2CPayout.findUnique({ where: { id: payout.id } });
      if (!currentPayout || currentPayout.status === 'SUCCEEDED') return;
      const currentSettlement = await transaction.merchantSettlement.findUnique({ where: { id: payout.settlementId } });
      if (!currentSettlement || currentSettlement.status !== 'PROCESSED') {
        throw new MpesaRequestError(409, 'Settlement is no longer awaiting this B2C result');
      }
      const balance = await transaction.merchantLedger.aggregate({
        where: { merchantId: currentSettlement.merchantId },
        _sum: { amountKes: true },
      });
      await transaction.mpesaB2CPayout.update({
        where: { id: currentPayout.id },
        data: {
          status: 'SUCCEEDED',
          resultCode: result.ResultCode,
          resultDescription: result.ResultDesc,
          payoutReference,
          completedAt: new Date(),
        },
      });
      await transaction.merchantSettlement.update({
        where: { id: currentSettlement.id },
        data: { status: 'PAID', payoutReference, disbursedAt: new Date() },
      });
      await transaction.merchantLedger.create({
        data: {
          merchantId: currentSettlement.merchantId,
          transactionType: 'SETTLEMENT_PAYOUT_DEBIT',
          amountKes: -currentSettlement.netPayoutKes,
          runningBalanceKes: (balance._sum.amountKes ?? 0) - currentSettlement.netPayoutKes,
          description: `Settlement ${currentSettlement.settlementNumber} paid (${payoutReference})`,
        },
      });
    }, { isolationLevel: 'Serializable' });
    enqueuePaymentEvent({
      type: 'settlement.mpesa.b2c.paid',
      entityId: payout.settlementId,
      merchantId: payout.settlement.merchantId,
      payload: { payoutReference },
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback acknowledged' });
  } catch (error) {
    console.error('B2C result processing failed', { requestId: req.requestId, error });
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Callback could not be processed' });
  }
}

mpesaWebhookRouter.post('/webhooks/mpesa/b2c/result', (req, res) => handleB2cResult(req, res, false));
mpesaWebhookRouter.post('/webhooks/mpesa/b2c/timeout', (req, res) => handleB2cResult(req, res, true));