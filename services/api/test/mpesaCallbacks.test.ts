import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mpesaB2cResultSchema,
  mpesaC2bCallbackSchema,
  mpesaStkCallbackSchema,
} from '@shipit/validation';
import { isMatchingC2bReplay } from '../src/mpesaHelpers.js';

test('accepts STK success metadata and failure callbacks without metadata', () => {
  const success = mpesaStkCallbackSchema.safeParse({
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant-request-1',
        CheckoutRequestID: 'checkout-request-1',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 1250 },
            { Name: 'MpesaReceiptNumber', Value: 'QAB123XYZ' },
          ],
        },
      },
    },
  });
  assert.equal(success.success, true);

  assert.equal(mpesaStkCallbackSchema.safeParse({
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant-request-1',
        CheckoutRequestID: 'checkout-request-1',
        ResultCode: 1032,
        ResultDesc: 'Request cancelled by user',
      },
    },
  }).success, true);
  assert.equal(mpesaStkCallbackSchema.safeParse({
    Body: { stkCallback: { CheckoutRequestID: 'missing-fields' } },
  }).success, false);
});

test('normalizes C2B callback fields and rejects invalid amounts', () => {
  const parsed = mpesaC2bCallbackSchema.safeParse({
    TransID: 'QAB123XYZ',
    TransAmount: '1250',
    BillRefNumber: 'ORDER-1',
    MSISDN: 254712345678,
    BusinessShortCode: 174379,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.TransAmount, 1250);
    assert.equal(parsed.data.MSISDN, '254712345678');
  }
  assert.equal(mpesaC2bCallbackSchema.safeParse({
    TransID: 'QAB123XYZ',
    TransAmount: '0',
    BillRefNumber: 'ORDER-1',
    MSISDN: '254712345678',
  }).success, false);
});

test('accepts B2C success and failure callback result shapes', () => {
  const base = {
    ConversationID: 'conversation-1',
    OriginatorConversationID: 'originator-1',
  };
  assert.equal(mpesaB2cResultSchema.safeParse({
    Result: {
      ...base,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      ResultParameters: {
        ResultParameter: [{ Key: 'TransactionReceipt', Value: 'QAB123XYZ' }],
      },
    },
  }).success, true);
  assert.equal(mpesaB2cResultSchema.safeParse({
    Result: { ...base, ResultCode: 2001, ResultDesc: 'The initiator information is invalid.' },
  }).success, true);
  assert.equal(mpesaB2cResultSchema.safeParse({
    Result: { ...base, ResultCode: '0', ResultDesc: 'Invalid result code type' },
  }).success, false);
});

test('only acknowledges an exact replay of a previously recorded C2B payment', () => {
  const payment = { orderId: 'order-1', merchantId: 'merchant-1', amountCollectedKes: 1250 };
  const order = { id: 'order-1', merchantId: 'merchant-1', codAmountExpectedKes: 1250, paymentMethod: 'COD_MPESA' };

  assert.equal(isMatchingC2bReplay(payment, order, 1250), true);
  assert.equal(isMatchingC2bReplay(payment, order, 1300), false);
  assert.equal(isMatchingC2bReplay(payment, { ...order, id: 'order-2' }, 1250), false);
  assert.equal(isMatchingC2bReplay(payment, { ...order, merchantId: 'merchant-2' }, 1250), false);
  assert.equal(isMatchingC2bReplay(payment, { ...order, paymentMethod: 'COD_CASH' }, 1250), false);
  assert.equal(isMatchingC2bReplay(null, order, 1250), false);
});
