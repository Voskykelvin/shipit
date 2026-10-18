import assert from 'node:assert/strict';
import test from 'node:test';
import { publicInquirySchema } from '@shipit/validation';

test('validates and normalizes a public commercial inquiry', () => {
  const inquiry = publicInquirySchema.parse({
    businessName: '  Acme Distribution  ',
    contactName: '  Amina Otieno ',
    phone: '0712345678',
    email: ' SALES@ACME.CO.KE ',
    estimatedMonthlyOrders: 500,
  });

  assert.equal(inquiry.businessName, 'Acme Distribution');
  assert.equal(inquiry.contactName, 'Amina Otieno');
  assert.equal(inquiry.phone, '+254712345678');
  assert.equal(inquiry.email, 'sales@acme.co.ke');
});

test('rejects incomplete public commercial inquiries', () => {
  assert.equal(publicInquirySchema.safeParse({ businessName: 'A' }).success, false);
  assert.equal(publicInquirySchema.safeParse({
    businessName: 'Acme',
    contactName: 'Amina',
    phone: 'not-a-phone-number',
    email: 'invalid-email',
  }).success, false);
});
