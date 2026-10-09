import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

interface Session {
  token: string;
  user: {
    roles: string[];
    merchantId: string | null;
  };
}

interface Merchant {
  id: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  barcode: string;
}

interface InboundShipment {
  id: string;
  status: string;
  grnNumber: string | null;
  items: Array<{ id: string }>;
}

interface ImportedOrder {
  id: string;
  orderNumber: string;
  status: string;
  waybillNumber?: string;
}

interface PickWave {
  id: string;
  status: string;
  tasks: Array<{
    id: string;
    allocationId: string;
    orderId: string;
    barcode: string;
    quantity: number;
  }>;
}

interface Route {
  id: string;
  routeCode: string;
  areasCovered: string[];
}

interface Manifest {
  id: string;
  totalParcels: number;
  expectedCodTotalKes: number;
}

interface RiderTasks {
  rider: { id: string };
  stops: Array<{
    id: string;
    orderNumber: string;
    waybillNumber?: string;
    status: string;
    codAmountKes: number;
  }>;
}

interface NdrCase {
  id: string;
  orderId: string;
}

interface Shift {
  isReconciled: boolean;
  expectedCodKes: number;
  expectedCashKes: number;
  cashHandedInKes: number;
}

interface Settlement {
  id: string;
  status: string;
  grossCodCollectedKes: number;
  totalFeesDeductedKes: number;
  netPayoutKes: number;
  payoutReference?: string;
}

interface ApiRequestOptions {
  token?: string;
  method?: string;
  body?: unknown;
  contentType?: string;
  expectedStatus?: number;
}

const apiUrl = process.env.SHIPIT_ACCEPTANCE_API_URL?.trim();
const adminEmail = process.env.SHIPIT_ACCEPTANCE_ADMIN_EMAIL?.trim();
const adminPassword = process.env.SHIPIT_ACCEPTANCE_ADMIN_PASSWORD;
const confirmWrites = process.env.SHIPIT_ACCEPTANCE_CONFIRM_DATA_WRITES;
const allowRemote = process.env.SHIPIT_ACCEPTANCE_ALLOW_REMOTE === 'true';
const API_PATH = '/api';
const ORDER_COUNT = 10;
const CANCELLED_ORDER_COUNT = 1;
const DELIVERED_ORDER_COUNT = 8;
const FAILED_ORDER_COUNT = ORDER_COUNT - CANCELLED_ORDER_COUNT - DELIVERED_ORDER_COUNT;
const RECEIVED_UNITS = 200;
const DAMAGED_UNITS = 2;
const ORDER_VALUE_KES = 1_000;
const DELIVERY_FEE_KES = 250;
const COD_PER_ORDER_KES = ORDER_VALUE_KES + DELIVERY_FEE_KES;

function resolveApiRoot(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SHIPIT_ACCEPTANCE_API_URL must use http or https');
  }

  const hostname = url.hostname.toLowerCase();
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!isLocal && !allowRemote) {
    throw new Error('Acceptance tests only allow localhost unless SHIPIT_ACCEPTANCE_ALLOW_REMOTE=true');
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname.endsWith(API_PATH) ? pathname : `${pathname}${API_PATH}`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

const apiRoot = apiUrl ? resolveApiRoot(apiUrl) : '';

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }

  const response = await fetch(`${apiRoot}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined
      ? undefined
      : options.contentType === 'text/csv'
        ? String(options.body)
        : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }

  const expectedStatus = options.expectedStatus ?? 200;
  assert.equal(
    response.status,
    expectedStatus,
    `${options.method ?? 'GET'} ${path} returned ${response.status}; expected ${expectedStatus}: ${JSON.stringify(payload)}`,
  );
  return payload as T;
}

async function login(email: string, password: string) {
  return request<Session>('/auth/login', { body: { email, password } });
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function buildOrdersCsv(merchantId: string, sku: string, suffix: string) {
  const columns = [
    'merchant_id',
    'external_reference',
    'customer_name',
    'customer_phone',
    'county',
    'town_or_sub_county',
    'estate_or_area',
    'landmark',
    'payment_method',
    'delivery_fee_kes',
    'product_sku',
    'quantity',
    'unit_price_kes',
  ];
  const rows = Array.from({ length: ORDER_COUNT }, (_, index) => [
    merchantId,
    `${suffix}-ORDER-${index + 1}`,
    `Acceptance Customer ${index + 1}`,
    '0712345678',
    'Nairobi',
    'Westlands',
    'Parklands',
    'Opposite the acceptance test landmark',
    'COD_CASH',
    DELIVERY_FEE_KES,
    sku,
    1,
    ORDER_VALUE_KES,
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

test('acceptance: inbound through merchant settlement', {
  skip: !apiUrl ? 'Set SHIPIT_ACCEPTANCE_API_URL to run the write-enabled local acceptance journey' : false,
  timeout: 180_000,
}, async () => {
  assert.ok(adminEmail, 'Set SHIPIT_ACCEPTANCE_ADMIN_EMAIL to a seeded SUPER_ADMIN login');
  assert.ok(adminPassword, 'Set SHIPIT_ACCEPTANCE_ADMIN_PASSWORD to a seeded SUPER_ADMIN password');
  assert.equal(confirmWrites, 'YES', 'Set SHIPIT_ACCEPTANCE_CONFIRM_DATA_WRITES=YES to acknowledge persistent test records');

  const admin = await login(adminEmail, adminPassword);
  assert.ok(admin.user.roles.includes('SUPER_ADMIN'), 'Acceptance login must have the SUPER_ADMIN role');

  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const merchantEmail = `acceptance-${suffix.toLowerCase()}@example.invalid`;
  const riderEmail = `acceptance-rider-${suffix.toLowerCase()}@example.invalid`;
  const testPassword = `Acceptance-${randomUUID()}-Aa9!`;
  const merchantCode = `AT-${suffix}`;
  const testDate = new Date().toISOString().slice(0, 10);

  const merchant = await request<Merchant>('/merchants', {
    token: admin.token,
    body: {
      code: merchantCode,
      name: `Acceptance Merchant ${suffix}`,
      contactEmail: merchantEmail,
      contactPhone: '0712345678',
    },
    expectedStatus: 201,
  });
  await request(`/merchants/${encodeURIComponent(merchant.id)}/users`, {
    token: admin.token,
    body: {
      email: merchantEmail,
      password: testPassword,
      phoneNumber: '0712345678',
      firstName: 'Acceptance',
      lastName: 'Merchant',
      role: 'MERCHANT_ADMIN',
    },
    expectedStatus: 201,
  });
  await request(`/merchants/${encodeURIComponent(merchant.id)}/activate`, {
    token: admin.token,
    body: {},
  });
  const merchantSession = await login(merchantEmail, testPassword);
  assert.equal(merchantSession.user.merchantId, merchant.id);

  const product = await request<Product>('/products', {
    token: admin.token,
    body: {
      merchantId: merchant.id,
      sku: `AT-${suffix}-SKU`,
      barcode: `AT-${suffix}-BARCODE`,
      name: `Acceptance Product ${suffix}`,
      declaredValueKes: ORDER_VALUE_KES,
      weightKg: 0.25,
      reorderThreshold: 0,
      isFragile: false,
      requiresColdStorage: false,
    },
    expectedStatus: 201,
  });

  const warehouses = await request<Array<{ id: string; code: string }>>('/inbound/warehouses', { token: admin.token });
  assert.ok(warehouses.length > 0, 'Seed the database with at least one active warehouse');
  const warehouse = warehouses[0];
  const locations = await request<Array<{ id: string; warehouseId: string; zone: string }>>('/inventory/locations', { token: admin.token });
  const putawayLocation = locations.find((location) =>
    location.warehouseId === warehouse.id && location.zone !== 'QUARANTINE',
  );
  assert.ok(putawayLocation, 'Seed the warehouse with an active non-quarantine location');

  const inbound = await request<InboundShipment>('/inbound', {
    token: merchantSession.token,
    body: {
      merchantId: merchant.id,
      warehouseId: warehouse.id,
      expectedDeliveryDate: testDate,
      notes: `Acceptance run ${suffix}`,
      items: [{ productId: product.id, expectedUnits: RECEIVED_UNITS }],
    },
    expectedStatus: 201,
  });
  assert.equal(inbound.items.length, 1);
  const receipt = await request<{ asn: InboundShipment }>('/inbound/' + encodeURIComponent(inbound.id) + '/receive', {
    token: admin.token,
    body: {
      items: [{
        inboundItemId: inbound.items[0].id,
        receivedUnits: RECEIVED_UNITS,
        damagedUnits: DAMAGED_UNITS,
        locationId: putawayLocation.id,
      }],
    },
  });
  assert.equal(receipt.asn.status, 'COMPLETED');
  assert.ok(receipt.asn.grnNumber, 'Receiving should issue a GRN');

  const stock = await request<Array<{ productId: string; availableQty: number; damagedQty: number }>>('/inventory/stock', {
    token: merchantSession.token,
  });
  const receivedStock = stock.find((item) => item.productId === product.id);
  assert.equal(receivedStock?.availableQty, RECEIVED_UNITS - DAMAGED_UNITS);
  assert.equal(receivedStock?.damagedQty, DAMAGED_UNITS);

  const imported = await request<{ importedCount: number; orders: ImportedOrder[] }>('/orders/import', {
    token: merchantSession.token,
    body: buildOrdersCsv(merchant.id, product.sku, suffix),
    contentType: 'text/csv',
    expectedStatus: 201,
  });
  assert.equal(imported.importedCount, ORDER_COUNT);
  assert.equal(imported.orders.length, ORDER_COUNT);

  const cancelledOrder = imported.orders[0];
  await request(`/orders/${encodeURIComponent(cancelledOrder.id)}/verify`, {
    token: admin.token,
    body: { isConfirmed: false, notes: 'Acceptance test cancellation' },
  });
  assert.equal(
    (await request<{ status: string }>(`/orders/${encodeURIComponent(cancelledOrder.id)}`, { token: admin.token })).status,
    'CANCELLED',
  );

  const fulfillOrders = imported.orders.slice(1);
  for (const order of fulfillOrders) {
    await request(`/orders/${encodeURIComponent(order.id)}/verify`, {
      token: admin.token,
      body: { isConfirmed: true, notes: 'Acceptance test confirmed' },
    });
  }

  const rider = await request<{ id: string }>('/riders', {
    token: admin.token,
    body: {
      email: riderEmail,
      password: testPassword,
      phoneNumber: '0712345678',
      firstName: 'Acceptance',
      lastName: 'Rider',
      nationalIdNumber: `AT${suffix}`,
      vehicleRegPlate: `AT${suffix}`,
    },
    expectedStatus: 201,
  });
  const riderSession = await login(riderEmail, testPassword);
  assert.ok(riderSession.user.roles.includes('RIDER'));

  const wave = await request<PickWave>('/fulfillment/waves', {
    token: admin.token,
    body: { orderIds: fulfillOrders.map((order) => order.id) },
    expectedStatus: 201,
  });
  assert.equal(wave.tasks.length, fulfillOrders.length);
  await request(`/fulfillment/waves/${encodeURIComponent(wave.id)}/start`, {
    token: admin.token,
    body: {},
  });

  const firstTask = wave.tasks[0];
  const wrongPick = await request<{ error: string }>('/fulfillment/pick', {
    token: admin.token,
    body: {
      orderId: firstTask.orderId,
      allocationId: firstTask.allocationId,
      pickTaskId: firstTask.id,
      scannedBarcode: 'WRONG-ACCEPTANCE-BARCODE',
      quantity: firstTask.quantity,
    },
    expectedStatus: 409,
  });
  assert.match(wrongPick.error, /barcode/i);

  for (const task of wave.tasks) {
    await request('/fulfillment/pick', {
      token: admin.token,
      body: {
        orderId: task.orderId,
        allocationId: task.allocationId,
        pickTaskId: task.id,
        scannedBarcode: task.barcode,
        quantity: task.quantity,
      },
    });
  }
  await request(`/fulfillment/waves/${encodeURIComponent(wave.id)}/complete`, {
    token: admin.token,
    body: {},
  });

  const packedOrders: ImportedOrder[] = [];
  for (const order of fulfillOrders) {
    const packed = await request<{ order: ImportedOrder }>('/fulfillment/pack', {
      token: admin.token,
      body: {
        orderId: order.id,
        scannedProductBarcodes: [product.barcode],
      },
    });
    assert.equal(packed.order.status, 'PACKED');
    assert.ok(packed.order.waybillNumber);
    packedOrders.push(packed.order);
  }

  const routes = await request<Route[]>('/dispatch/routes', { token: admin.token });
  const route = routes.find((item) => item.areasCovered.some((area) => area.toLowerCase() === 'westlands'));
  assert.ok(route, 'Seed an active route serving Westlands');
  const otherRoute = routes.find((item) => item.id !== route.id);
  assert.ok(otherRoute, 'Seed a second route for wrong-route validation');

  const wrongRoute = await request<{ errorType: string }>('/dispatch/scan-waybill', {
    token: admin.token,
    body: {
      barcode: packedOrders[0].waybillNumber,
      targetRouteCode: otherRoute.routeCode,
    },
    expectedStatus: 409,
  });
  assert.equal(wrongRoute.errorType, 'ROUTE_MISMATCH');

  const manifest = await request<Manifest>('/dispatch/manifests', {
    token: admin.token,
    body: { routeId: route.id, riderId: rider.id },
    expectedStatus: 201,
  });
  for (const order of packedOrders) {
    const scan: { valid: boolean; addedToManifest: boolean } = await request('/dispatch/scan-waybill', {
      token: admin.token,
      body: {
        barcode: order.waybillNumber,
        targetRouteCode: route.routeCode,
        manifestId: manifest.id,
      },
    });
    assert.equal(scan.valid, true);
    assert.equal(scan.addedToManifest, true);
  }
  const stagedManifests = await request<Manifest[]>('/dispatch/manifests', { token: admin.token });
  const stagedManifest = stagedManifests.find((item) => item.id === manifest.id);
  assert.ok(stagedManifest, 'Scanned parcels should remain on the staged manifest');

  const badHandover = await request<{ error: string }>(`/dispatch/manifests/${encodeURIComponent(stagedManifest.id)}/handover`, {
    token: admin.token,
    body: {
      acceptedParcelCount: stagedManifest.totalParcels - 1,
      acceptedCodTotalKes: stagedManifest.expectedCodTotalKes,
    },
    expectedStatus: 409,
  });
  assert.match(badHandover.error, /must match/i);
  await request(`/dispatch/manifests/${encodeURIComponent(stagedManifest.id)}/handover`, {
    token: admin.token,
    body: {
      acceptedParcelCount: stagedManifest.totalParcels,
      acceptedCodTotalKes: stagedManifest.expectedCodTotalKes,
    },
  });

  const tasks = await request<RiderTasks>('/riders/me/tasks', { token: riderSession.token });
  assert.equal(tasks.rider.id, rider.id);
  assert.equal(tasks.stops.length, fulfillOrders.length);
  const failedOrder = tasks.stops[0];
  await request('/delivery/fail', {
    token: riderSession.token,
    body: {
      orderId: failedOrder.id,
      riderId: rider.id,
      failureReason: 'CUSTOMER_UNREACHABLE',
    },
    expectedStatus: 201,
  });

  const ndrCases = await request<NdrCase[]>('/ndr', { token: admin.token });
  const ndrCase = ndrCases.find((item) => item.orderId === failedOrder.id);
  assert.ok(ndrCase, 'Failed delivery should create an NDR case');
  await request(`/ndr/${encodeURIComponent(ndrCase.id)}/resolve`, {
    token: admin.token,
    body: { resolution: 'RTO', notes: `Acceptance test RTO ${suffix}` },
  });

  const remainingTasks = await request<RiderTasks>('/riders/me/tasks', { token: riderSession.token });
  assert.equal(remainingTasks.stops.length, DELIVERED_ORDER_COUNT);
  assert.equal(fulfillOrders.length - remainingTasks.stops.length, FAILED_ORDER_COUNT);
  const returns = await request<Array<{ orderId: string; returnType: string; status: string }>>('/returns', {
    token: admin.token,
  });
  const rto = returns.find((record) => record.orderId === failedOrder.id);
  assert.equal(rto?.returnType, 'IMMEDIATE_RTO');
  assert.equal(rto?.status, 'IN_TRANSIT');

  for (const stop of remainingTasks.stops) {
    const packedOrder = packedOrders.find((order) => order.id === stop.id);
    assert.ok(packedOrder?.waybillNumber, `Packed order ${stop.orderNumber} should have a waybill`);
    assert.equal(stop.waybillNumber, packedOrder.waybillNumber, 'Rider stop should include its parcel-scanning barcode');
    const submission = {
      orderId: stop.id,
      riderId: rider.id,
      submissionId: randomUUID(),
      recipientName: 'Acceptance Recipient',
      paymentChannel: 'CASH',
      amountCollectedKes: COD_PER_ORDER_KES,
    };
    const delivery = await request<{ order: { status: string } }>('/delivery/complete', {
      token: riderSession.token,
      body: submission,
    });
    assert.equal(delivery.order.status, 'DELIVERED');
    if (stop === remainingTasks.stops[0]) {
      const retry = await request<{ order: { status: string }; replayed: boolean }>('/delivery/complete', {
        token: riderSession.token,
        body: submission,
      });
      assert.equal(retry.order.status, 'DELIVERED');
      assert.equal(retry.replayed, true);
    }
  }

  const waybillNumber = packedOrders.find((order) => order.id === remainingTasks.stops[0]?.id)?.waybillNumber;
  assert.ok(waybillNumber);
  const tracking = await request<{ trackingNumber: string; status: string }>(`/tracking/${encodeURIComponent(waybillNumber)}`);
  assert.equal(tracking.trackingNumber, waybillNumber);
  assert.equal(tracking.status, 'DELIVERED');

  const shiftResult = await request<{ shift: Shift }>('/finance/rider-shifts/closeout', {
    token: admin.token,
    body: {
      riderId: rider.id,
      shiftDate: testDate,
      cashHandedInKes: DELIVERED_ORDER_COUNT * COD_PER_ORDER_KES,
    },
  });
  assert.equal(shiftResult.shift.isReconciled, true);
  assert.equal(shiftResult.shift.expectedCashKes, DELIVERED_ORDER_COUNT * COD_PER_ORDER_KES);
  assert.equal(shiftResult.shift.cashHandedInKes, DELIVERED_ORDER_COUNT * COD_PER_ORDER_KES);

  const finalStock = await request<Array<{ productId: string; availableQty: number; reservedQty: number; damagedQty: number }>>('/inventory/stock', {
    token: merchantSession.token,
  });
  const remainingStock = finalStock.find((item) => item.productId === product.id);
  assert.equal(remainingStock?.availableQty, RECEIVED_UNITS - DAMAGED_UNITS - fulfillOrders.length);
  assert.equal(remainingStock?.reservedQty, 0);
  assert.equal(remainingStock?.damagedQty, DAMAGED_UNITS);

  const ledgers = await request<Array<{ type: string; amountKes: number }>>('/finance/ledgers', {
    token: merchantSession.token,
  });
  const credits = ledgers.filter((entry) => entry.type === 'COD_CREDIT');
  assert.equal(credits.length, DELIVERED_ORDER_COUNT);
  assert.equal(credits.reduce((sum, entry) => sum + entry.amountKes, 0), DELIVERED_ORDER_COUNT * COD_PER_ORDER_KES);

  const settlement = await request<Settlement>('/finance/settlements', {
    token: merchantSession.token,
    body: {
      merchantId: merchant.id,
      periodStart: testDate,
      periodEnd: testDate,
    },
    expectedStatus: 201,
  });
  assert.equal(settlement.status, 'DRAFT');
  assert.equal(settlement.grossCodCollectedKes, DELIVERED_ORDER_COUNT * COD_PER_ORDER_KES);
  assert.ok(settlement.totalFeesDeductedKes > 0);
  assert.ok(settlement.netPayoutKes > 0);

  await request('/finance/settlements/approve', {
    token: admin.token,
    body: { settlementId: settlement.id },
  });
  const paid = await request<Settlement>(`/finance/settlements/${encodeURIComponent(settlement.id)}/paid`, {
    token: admin.token,
    body: { payoutReference: `ACCEPTANCE-${suffix}` },
  });
  assert.equal(paid.status, 'DISBURSED');
  assert.equal(paid.payoutReference, `ACCEPTANCE-${suffix}`);
});
