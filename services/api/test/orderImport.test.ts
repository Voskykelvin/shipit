import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderCsvError, parseOrderCsv } from '../src/orderImport.js';

const columns = [
  'merchant_id', 'external_reference', 'customer_name', 'customer_phone', 'county',
  'town_or_sub_county', 'estate_or_area', 'landmark', 'payment_method', 'product_sku',
  'quantity', 'unit_price_kes',
];

function row(externalReference: string, sku: string, name = 'Amina Otieno') {
  return ['merchant-1', externalReference, name, '0712345678', 'Nairobi', 'Westlands', 'Parklands', 'Near the mall', 'COD_MPESA', sku, '1', '2500']
    .map((value) => `"${value}"`).join(',');
}

function csv(...rows: string[]) {
  return [columns.join(','), ...rows].join('\n');
}

test('groups product rows with the same merchant and external reference', () => {
  const [order] = parseOrderCsv(csv(row('shop-42', 'SERUM'), row('shop-42', 'CREAM')));

  assert.equal(order.externalReference, 'shop-42');
  assert.equal(order.customerPhone, '+254712345678');
  assert.deepEqual(order.items, [
    { sku: 'SERUM', quantity: 1, unitPriceKes: 2500 },
    { sku: 'CREAM', quantity: 1, unitPriceKes: 2500 },
  ]);
});

test('rejects conflicting order headers within one external reference', () => {
  assert.throws(
    () => parseOrderCsv(csv(row('shop-42', 'SERUM'), row('shop-42', 'CREAM', 'Different Customer'))),
    OrderCsvError,
  );
});

test('rejects invalid row data with its CSV row number', () => {
  const invalidRow = row('shop-42', 'SERUM').replace(',"1","2500"', ',"0","2500"');
  assert.throws(
    () => parseOrderCsv(csv(invalidRow)),
    /CSV row 2 is invalid/,
  );
});

test('rejects empty and malformed CSV documents', () => {
  assert.throws(() => parseOrderCsv(`${columns.join(',')}\n`), OrderCsvError);
  assert.throws(() => parseOrderCsv('"merchant_id,"broken'), OrderCsvError);
});
