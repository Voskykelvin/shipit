import assert from 'node:assert/strict';
import test from 'node:test';
import { approveRiderShiftVarianceSchema, submitPodSchema } from '@shipit/validation';

test('requires a non-empty reason for cash-variance approval', () => {
  assert.deepEqual(
    approveRiderShiftVarianceSchema.parse({ approvalNotes: 'Reviewed cash count' }),
    { approvalNotes: 'Reviewed cash count' },
  );
  assert.equal(approveRiderShiftVarianceSchema.safeParse({ approvalNotes: '  ' }).success, false);
  assert.equal(approveRiderShiftVarianceSchema.safeParse({ approvalNotes: 'ok' }).success, false);
  assert.equal(
    approveRiderShiftVarianceSchema.safeParse({ approvalNotes: 'x'.repeat(1001) }).success,
    false,
  );
});

test('validates bounded POD media and client submission IDs', () => {
  const validSubmission = {
    orderId: 'order-1',
    riderId: 'rider-1',
    submissionId: '1de2b855-4b64-4b1e-aad1-f8163d9342f8',
    recipientName: 'Amina',
    paymentChannel: 'CASH',
    amountCollectedKes: 2500,
  };
  assert.equal(submitPodSchema.safeParse(validSubmission).success, true);
  assert.equal(submitPodSchema.safeParse({ ...validSubmission, submissionId: 'not-a-uuid' }).success, false);
  assert.equal(submitPodSchema.safeParse({ ...validSubmission, photoUrl: 'x'.repeat(850_000) }).success, false);
  assert.equal(
    submitPodSchema.safeParse({
      ...validSubmission,
      signatureUrl: 'x'.repeat(300_000),
      photoUrl: 'x'.repeat(600_000),
    }).success,
    false,
  );
});
