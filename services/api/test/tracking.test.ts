import assert from 'node:assert/strict';
import test from 'node:test';
import { publicFailureDetail } from '../src/tracking.js';

test('public tracking uses customer-safe delivery failure details', () => {
  assert.equal(
    publicFailureDetail('CUSTOMER_UNREACHABLE'),
    'We could not reach you to complete this delivery attempt.',
  );
  assert.equal(
    publicFailureDetail('WRONG_LOCATION'),
    'We need help confirming the delivery location.',
  );
  assert.equal(
    publicFailureDetail('RESCHEDULE_REQUESTED'),
    'A new delivery time has been requested.',
  );
  assert.equal(publicFailureDetail('REFUSED_DELIVERY'), 'Delivery was declined.');
  assert.equal(
    publicFailureDetail('CASH_SHORTAGE'),
    'Delivery could not be completed on this attempt.',
  );
  assert.equal(publicFailureDetail(null), undefined);
});
