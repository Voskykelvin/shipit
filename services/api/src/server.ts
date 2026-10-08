import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  merchants,
  products,
  locations,
  inventoryStock,
  inventoryTransactions,
  inboundShipments,
  routes,
  riders,
  orders,
  ndrCases,
  manifests,
  codTransactions,
  riderShifts,
  merchantLedgers,
  settlements,
  exceptions,
} from './mockData.js';
import { createOrderSchema, submitPodSchema } from '@shipit/validation';
import { Order, OrderStatus } from '@shipit/shared-types';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. HEALTH & CONTROL TOWER SUMMARY
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'shipit-api', timestamp: new Date().toISOString() });
});

app.get('/api/control-tower/summary', (_req: Request, res: Response) => {
  const totalOrdersToday = orders.length;
  const pendingVerification = orders.filter((o) => o.status === 'PENDING_VERIFICATION').length;
  const readyToPick = orders.filter((o) => o.status === 'READY_FOR_PICK').length;
  const packed = orders.filter((o) => o.status === 'PACKED').length;
  const outForDelivery = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
  const ndrExceptions = orders.filter((o) => o.status === 'NDR_EXCEPTION').length;

  const totalCodCollected = codTransactions.reduce((acc, c) => acc + c.amountCollectedKes, 0);
  const totalCodPending = orders
    .filter((o) => ['MANIFESTED', 'OUT_FOR_DELIVERY', 'NDR_EXCEPTION'].includes(o.status))
    .reduce((acc, o) => acc + o.codAmountExpectedKes, 0);

  const activeExceptions = exceptions.filter((e) => !e.isResolved);

  res.json({
    kpis: {
      totalOrdersToday,
      pendingVerification,
      readyToPick,
      packed,
      outForDelivery,
      delivered,
      ndrExceptions,
      totalCodCollectedKes: totalCodCollected,
      totalCodPendingKes: totalCodPending,
      deliverySuccessRatePct: 88.5,
      rtoRatePct: 4.8,
    },
    openExceptionsCount: activeExceptions.length,
    activeExceptions,
  });
});

// ==========================================
// 2. EXCEPTIONS MANAGEMENT
// ==========================================
app.get('/api/exceptions', (_req: Request, res: Response) => {
  res.json(exceptions);
});

app.post('/api/exceptions/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const exc = exceptions.find((e) => e.id === id);
  if (!exc) {
    return res.status(404).json({ error: 'Exception not found' });
  }
  exc.isResolved = true;
  exc.resolvedByUserId = req.body.resolvedByUserId || 'usr-supervisor';
  res.json({ success: true, exception: exc });
});

// ==========================================
// 3. ORDERS ENGINE
// ==========================================
app.get('/api/orders', (req: Request, res: Response) => {
  const { status, merchantId, search } = req.query;
  let filtered = [...orders];

  if (status) {
    filtered = filtered.filter((o) => o.status === status);
  }
  if (merchantId) {
    filtered = filtered.filter((o) => o.merchantId === merchantId);
  }
  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.customerPhone.includes(s) ||
        (o.waybillNumber && o.waybillNumber.toLowerCase().includes(s))
    );
  }

  res.json(filtered);
});

app.get('/api/orders/:id', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', (req: Request, res: Response) => {
  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
  }

  const data = parseResult.data;
  const newOrderNumber = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const newWaybill = `WB-${newOrderNumber.slice(4)}-KE`;

  let orderValue = 0;
  const mappedItems = data.items.map((it, idx) => {
    const prod = products.find((p) => p.id === it.productId);
    const price = it.unitPriceKes;
    orderValue += price * it.quantity;
    return {
      id: `oi-${Date.now()}-${idx}`,
      orderId: `ord-${Date.now()}`,
      productId: it.productId,
      sku: prod?.sku || 'SKU-UNKNOWN',
      productName: prod?.name || 'Product',
      quantity: it.quantity,
      unitPriceKes: price,
      allocatedLocationId: 'loc-01',
    };
  });

  const totalCod = data.paymentMethod.startsWith('COD') ? orderValue + data.deliveryFeeKes : 0;

  const newOrder: Order = {
    id: `ord-${Date.now()}`,
    merchantId: data.merchantId,
    orderNumber: newOrderNumber,
    externalReference: data.externalReference,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAltPhone: data.customerAltPhone,
    address: data.address,
    items: mappedItems,
    orderValueKes: orderValue,
    deliveryFeeKes: data.deliveryFeeKes,
    codAmountExpectedKes: totalCod,
    paymentMethod: data.paymentMethod,
    status: data.paymentMethod.startsWith('COD') ? 'PENDING_VERIFICATION' : 'READY_FOR_PICK',
    preferredDeliveryDate: data.preferredDeliveryDate,
    verificationNotes: data.verificationNotes,
    waybillNumber: newWaybill,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  orders.unshift(newOrder);

  // Reserve inventory
  data.items.forEach((it) => {
    const stock = inventoryStock.find((s) => s.productId === it.productId);
    if (stock) {
      stock.availableQty = Math.max(0, stock.availableQty - it.quantity);
      stock.reservedQty += it.quantity;
    }
  });

  res.status(201).json(newOrder);
});

// Customer Care verification
app.post('/api/orders/:id/verify', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { isConfirmed, notes } = req.body;
  if (isConfirmed) {
    order.status = 'READY_FOR_PICK';
    order.verificationNotes = notes || 'Customer confirmed by phone.';
    order.verifiedByUserId = req.body.verifiedByUserId || 'usr-cc-agent';
    order.verifiedAt = new Date().toISOString();
  } else {
    order.status = 'CANCELLED';
    order.verificationNotes = notes || 'Customer cancelled or unreachable.';
    // Release reserved inventory
    order.items.forEach((it) => {
      const stock = inventoryStock.find((s) => s.productId === it.productId);
      if (stock) {
        stock.availableQty += it.quantity;
        stock.reservedQty = Math.max(0, stock.reservedQty - it.quantity);
      }
    });
  }
  order.updatedAt = new Date().toISOString();

  res.json({ success: true, order });
});

// Update order status (Pick -> Pack -> Dispatch)
app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status } = req.body as { status: OrderStatus };
  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json({ success: true, order });
});

// ==========================================
// 4. WAREHOUSE & INVENTORY
// ==========================================
app.get('/api/inventory/stock', (_req: Request, res: Response) => {
  res.json(inventoryStock);
});

app.get('/api/inventory/locations', (_req: Request, res: Response) => {
  res.json(locations);
});

app.get('/api/inventory/transactions', (_req: Request, res: Response) => {
  res.json(inventoryTransactions);
});

app.post('/api/inventory/adjust', (req: Request, res: Response) => {
  const { productId, locationId, deltaAvailable, deltaDamaged, reasonCode, supervisorApprovedBy } = req.body;
  const stock = inventoryStock.find((s) => s.productId === productId);
  if (!stock) return res.status(404).json({ error: 'Product stock record not found' });

  stock.availableQty += Number(deltaAvailable) || 0;
  stock.damagedQty += Number(deltaDamaged) || 0;
  stock.totalPhysicalQty = stock.availableQty + stock.reservedQty + stock.damagedQty + stock.quarantineQty;

  const tx = {
    id: `tx-${Date.now()}`,
    productId,
    locationId,
    type: 'SUPERVISOR_ADJUSTMENT' as const,
    referenceId: `ADJ-${Date.now()}`,
    deltaAvailable: Number(deltaAvailable) || 0,
    deltaReserved: 0,
    deltaDamaged: Number(deltaDamaged) || 0,
    deltaQuarantine: 0,
    performedByUserId: req.body.performedByUserId || 'usr-wh-manager',
    supervisorApprovedBy,
    reasonCode: reasonCode || 'Audit discrepancy adjustment',
    createdAt: new Date().toISOString(),
  };

  inventoryTransactions.unshift(tx);
  res.json({ success: true, stock, transaction: tx });
});

// Inbound / ASN
app.get('/api/inbound', (_req: Request, res: Response) => {
  res.json(inboundShipments);
});

app.post('/api/inbound/:id/receive', (req: Request, res: Response) => {
  const asn = inboundShipments.find((s) => s.id === req.params.id);
  if (!asn) return res.status(404).json({ error: 'ASN not found' });

  const { receivedUnits, damagedUnits, locationId } = req.body;
  asn.status = 'COMPLETED';
  asn.grnNumber = `GRN-${asn.asnNumber.replace('ASN-', '')}`;

  if (asn.items[0]) {
    asn.items[0].receivedUnits = receivedUnits;
    asn.items[0].damagedUnits = damagedUnits;
    asn.items[0].locationId = locationId;

    const stock = inventoryStock.find((s) => s.productId === asn.items[0].productId);
    if (stock) {
      stock.availableQty += receivedUnits - damagedUnits;
      stock.damagedQty += damagedUnits;
      stock.totalPhysicalQty += receivedUnits;
    }
  }

  res.json({ success: true, asn });
});

// ==========================================
// 5. DISPATCH & WAYBILL SCAN STATION
// ==========================================
app.get('/api/dispatch/routes', (_req: Request, res: Response) => {
  res.json(routes);
});

app.get('/api/dispatch/manifests', (_req: Request, res: Response) => {
  res.json(manifests);
});

// CORE OPERATIONAL DIFFERENTIATOR:
// Scanning waybill verifies whether the parcel belongs to the target route manifest
app.post('/api/dispatch/scan-waybill', (req: Request, res: Response) => {
  const { barcode, targetRouteCode, manifestId } = req.body;
  if (!barcode) return res.status(400).json({ error: 'Barcode is required' });

  // Locate order by tracking number or order number
  const order = orders.find(
    (o) =>
      o.waybillNumber?.toLowerCase() === barcode.trim().toLowerCase() ||
      o.orderNumber.toLowerCase() === barcode.trim().toLowerCase()
  );

  if (!order) {
    return res.status(404).json({
      valid: false,
      errorType: 'PARCEL_NOT_FOUND',
      message: `No parcel found matching barcode: ${barcode}`,
    });
  }

  // Derive parcel's designated route by town/subcounty
  const town = (order.address.townOrSubCounty || '').toLowerCase();
  let correctRouteCode = 'WESTLANDS-01';
  if (town.includes('kilimani') || town.includes('kileleshwa') || town.includes('lavington')) {
    correctRouteCode = 'KILIMANI-02';
  } else if (town.includes('roysambu') || town.includes('kasarani') || town.includes('thika') || town.includes('ruiru')) {
    correctRouteCode = 'THIKA-RD-01';
  } else if (town.includes('south') || town.includes('mombasa')) {
    correctRouteCode = 'MOMBASA-RD-01';
  }

  // Route check
  if (targetRouteCode && targetRouteCode !== correctRouteCode) {
    return res.status(409).json({
      valid: false,
      errorType: 'ROUTE_MISMATCH',
      message: `CRITICAL ROUTE MISMATCH! Parcel belongs to [${correctRouteCode}], but target manifest is [${targetRouteCode}].`,
      order,
      correctRouteCode,
      targetRouteCode,
    });
  }

  // Parcel is valid for this route! Add to manifest if manifestId provided
  if (manifestId) {
    const manifest = manifests.find((m) => m.id === manifestId);
    if (manifest && !manifest.parcels.includes(order.waybillNumber || order.orderNumber)) {
      manifest.parcels.push(order.waybillNumber || order.orderNumber);
      manifest.totalParcels = manifest.parcels.length;
      manifest.expectedCodTotalKes += order.codAmountExpectedKes;
      order.status = 'MANIFESTED';
      order.manifestId = manifest.id;
    }
  }

  res.json({
    valid: true,
    message: 'Valid Parcel. Route verified.',
    order,
    correctRouteCode,
  });
});

app.post('/api/dispatch/manifests', (req: Request, res: Response) => {
  const { routeId, riderId } = req.body;
  const route = routes.find((r) => r.id === routeId);
  const rider = riders.find((r) => r.id === riderId);
  if (!route || !rider) return res.status(400).json({ error: 'Route and Rider required' });

  const newManifest = {
    id: `mnf-${Date.now()}`,
    manifestNumber: `MNF-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    routeId: route.id,
    routeCode: route.routeCode,
    riderId: rider.id,
    riderName: rider.name,
    status: 'STAGED' as const,
    parcels: [],
    totalParcels: 0,
    expectedCodTotalKes: 0,
    createdAt: new Date().toISOString(),
  };

  manifests.unshift(newManifest);
  res.status(201).json(newManifest);
});

app.post('/api/dispatch/manifests/:id/handover', (req: Request, res: Response) => {
  const manifest = manifests.find((m) => m.id === req.params.id);
  if (!manifest) return res.status(404).json({ error: 'Manifest not found' });

  manifest.status = 'IN_TRANSIT';
  manifest.dispatchedAt = new Date().toISOString();

  // Mark all orders out for delivery
  manifest.parcels.forEach((p) => {
    const o = orders.find((ord) => ord.waybillNumber === p || ord.orderNumber === p);
    if (o) o.status = 'OUT_FOR_DELIVERY';
  });

  res.json({ success: true, manifest });
});

// ==========================================
// 6. RIDER APP & PROOF OF DELIVERY
// ==========================================
app.get('/api/riders', (_req: Request, res: Response) => {
  res.json(riders);
});

app.get('/api/riders/:id/tasks', (req: Request, res: Response) => {
  const rider = riders.find((r) => r.id === req.params.id);
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  // Get orders on rider's current manifests
  const activeManifests = manifests.filter((m) => m.riderId === rider.id && m.status === 'IN_TRANSIT');
  const parcelSet = new Set(activeManifests.flatMap((m) => m.parcels));

  const assignedOrders = orders.filter(
    (o) => parcelSet.has(o.waybillNumber || '') || (o.status === 'OUT_FOR_DELIVERY' && o.manifestId)
  );

  res.json({
    rider,
    stops: assignedOrders,
    totalCodExpected: assignedOrders.reduce((sum, o) => sum + o.codAmountExpectedKes, 0),
  });
});

app.post('/api/delivery/complete', (req: Request, res: Response) => {
  const parse = submitPodSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid POD data', details: parse.error.format() });

  const data = parse.data;
  const order = orders.find((o) => o.id === data.orderId || o.orderNumber === data.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'DELIVERED';
  order.updatedAt = new Date().toISOString();

  // Record COD collection
  if (data.amountCollectedKes > 0) {
    const codTx = {
      id: `cod-${Date.now()}`,
      orderId: order.id,
      merchantId: order.merchantId,
      riderId: data.riderId,
      channel: data.paymentChannel as 'MPESA_STK' | 'MPESA_C2B' | 'CASH',
      amountCollectedKes: data.amountCollectedKes,
      mpesaReceiptNumber: data.mpesaReceiptNumber || `SIM-${Date.now()}`,
      isReconciled: true,
      collectedAt: new Date().toISOString(),
    };
    codTransactions.unshift(codTx);

    // Update merchant financial ledger
    const currentBal = merchantLedgers.length ? merchantLedgers[0].runningBalanceKes : 0;
    merchantLedgers.unshift({
      id: `ledg-${Date.now()}`,
      merchantId: order.merchantId,
      orderId: order.id,
      type: 'COD_CREDIT',
      amountKes: data.amountCollectedKes,
      runningBalanceKes: currentBal + data.amountCollectedKes,
      description: `Delivered ${order.orderNumber} via ${data.paymentChannel}`,
      createdAt: new Date().toISOString(),
    });
  }

  res.json({ success: true, order });
});

// Rider failed delivery trigger -> Creates instant NDR case
app.post('/api/delivery/fail', (req: Request, res: Response) => {
  const { orderId, riderId, failureReason, notes } = req.body;
  const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  const rider = riders.find((r) => r.id === riderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'NDR_EXCEPTION';
  order.updatedAt = new Date().toISOString();

  const newNdr = {
    id: `ndr-${Date.now()}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    area: `${order.address.townOrSubCounty} / ${order.address.estateOrArea}`,
    riderName: rider?.name || 'Rider',
    failureReason: failureReason || 'CUSTOMER_UNREACHABLE',
    status: 'OPEN' as const,
    actionTakenNotes: notes,
    createdAt: new Date().toISOString(),
  };

  ndrCases.unshift(newNdr);

  exceptions.unshift({
    id: `exc-${Date.now()}`,
    category: 'FAILED_DELIVERY',
    severity: 'HIGH',
    title: `NDR: ${order.orderNumber} - ${newNdr.failureReason}`,
    details: `Rider ${newNdr.riderName} reported failed delivery in ${newNdr.area}. Needs immediate customer care call.`,
    entityId: order.id,
    entityType: 'ORDER',
    isResolved: false,
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, order, ndrCase: newNdr });
});

// ==========================================
// 7. NDR & CUSTOMER CARE INTERCEPTION
// ==========================================
app.get('/api/ndr', (_req: Request, res: Response) => {
  res.json(ndrCases);
});

app.post('/api/ndr/:id/resolve', (req: Request, res: Response) => {
  const ndr = ndrCases.find((n) => n.id === req.params.id);
  if (!ndr) return res.status(404).json({ error: 'NDR case not found' });

  const { resolution, notes } = req.body; // 'RETRY' or 'RTO'
  ndr.status = resolution === 'RETRY' ? 'RESOLVED_RETRY' : 'RESOLVED_RTO';
  ndr.actionTakenNotes = notes;

  const order = orders.find((o) => o.id === ndr.orderId);
  if (order) {
    order.status = resolution === 'RETRY' ? 'OUT_FOR_DELIVERY' : 'RETURN_IN_TRANSIT';
    order.updatedAt = new Date().toISOString();
  }

  res.json({ success: true, ndrCase: ndr, order });
});

// ==========================================
// 8. FINANCE & RECONCILIATION
// ==========================================
app.get('/api/finance/rider-shifts', (_req: Request, res: Response) => {
  res.json(riderShifts);
});

app.post('/api/finance/rider-shifts/closeout', (req: Request, res: Response) => {
  const { shiftId, cashHandedInKes, supervisorApprovedBy, varianceNotes } = req.body;
  const shift = riderShifts.find((s) => s.id === shiftId);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  shift.cashHandedInKes = Number(cashHandedInKes);
  shift.varianceKes = shift.cashHandedInKes - shift.expectedCashKes;

  if (shift.varianceKes !== 0) {
    if (!supervisorApprovedBy) {
      return res.status(409).json({
        error: 'CASH_VARIANCE_BLOCKED',
        message: `Shift has cash variance of KES ${shift.varianceKes}. Supervisor approval required to close shift.`,
        varianceKes: shift.varianceKes,
      });
    }
    shift.isReconciled = true;
    shift.supervisorApprovedBy = supervisorApprovedBy;
    shift.varianceNotes = varianceNotes;
    shift.closedAt = new Date().toISOString();
  } else {
    shift.isReconciled = true;
    shift.closedAt = new Date().toISOString();
  }

  res.json({ success: true, shift });
});

app.get('/api/finance/ledgers', (req: Request, res: Response) => {
  const { merchantId } = req.query;
  const filtered = merchantId
    ? merchantLedgers.filter((l) => l.merchantId === merchantId)
    : merchantLedgers;
  res.json(filtered);
});

app.get('/api/finance/settlements', (_req: Request, res: Response) => {
  res.json(settlements);
});

app.post('/api/finance/settlements/approve', (req: Request, res: Response) => {
  const { settlementId } = req.body;
  const s = settlements.find((item) => item.id === settlementId);
  if (!s) return res.status(404).json({ error: 'Settlement not found' });

  s.status = 'DISBURSED';
  s.payoutReference = `MPESA-B2C-${Date.now()}`;
  s.disbursedAt = new Date().toISOString();

  res.json({ success: true, settlement: s });
});

// Generic merchants endpoint
app.get('/api/merchants', (_req: Request, res: Response) => {
  res.json(merchants);
});

app.listen(PORT, () => {
  console.log(`Ship It Master Backend API operational on http://localhost:${PORT}`);
});
