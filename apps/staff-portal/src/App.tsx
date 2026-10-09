import { useCallback, useEffect, useState } from 'react';
import { api, type AuthSession } from '@shipit/api-client';
import type {
  DispatchManifest, InventoryStockSummary, MerchantLedgerEntry, MerchantSettlement, NDRCase,
  Order, Rider, RiderShiftReconciliation, SystemException, WarehouseLocation,
} from '@shipit/shared-types';
import {
  AlertTriangle, Barcode, Boxes, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, ClipboardList, FileUp, LayoutDashboard, LogOut, Package, Plus,
  RefreshCw, RotateCcw, Settings, ShieldAlert, Truck, Users, Warehouse, XCircle,
} from 'lucide-react';

type Tab = 'overview' | 'orders' | 'warehouse' | 'picking' | 'dispatch' | 'exceptions' | 'returns' | 'finance' | 'setup';

interface Summary {
  kpis: {
    totalOrdersToday: number;
    pendingVerification: number;
    readyToPick: number;
    packed: number;
    outForDelivery: number;
    delivered: number;
    ndrExceptions: number;
    totalCodCollectedKes: number;
    totalCodPendingKes: number;
    deliverySuccessRatePct: number;
    rtoRatePct: number;
  };
  activeExceptions: SystemException[];
}

interface RouteInfo {
  id: string;
  routeCode: string;
  name: string;
  areasCovered: string[];
  isActive: boolean;
}

interface PickTask {
  id: string;
  allocationId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  sku: string;
  productName: string;
  barcode: string;
  quantity: number;
  pickedQuantity: number;
  location: { id: string; barcode: string; zone: string };
  isConfirmed: boolean;
}

interface PickWave {
  id: string;
  waveNumber: string;
  status: string;
  taskCount: number;
  confirmedTaskCount: number;
  tasks: PickTask[];
}

interface InboundShipment {
  id: string;
  asnNumber: string;
  warehouseId: string;
  status: string;
  expectedDeliveryDate: string;
  items: Array<{ id: string; productId: string; expectedUnits: number; receivedUnits: number; damagedUnits: number }>;
}

interface Product {
  id: string;
  merchantId: string;
  sku: string;
  barcode: string;
  name: string;
  declaredValueKes: number;
  weightKg: number;
}

interface Merchant {
  id: string;
  code: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}

interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  merchantId: string;
  returnType: string;
  status: string;
  reason: string;
  items: Array<{ id: string; productId: string; expectedUnits: number; receivedUnits: number; inspectedUnits: number; product: { sku: string; name: string } }>;
  order: { id: string; orderNumber: string; status: string };
}

interface ApiRider extends Rider {
  vehiclePlate: string;
}

const currency = (amount: number) => `KES ${amount.toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);

const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Control tower', icon: <LayoutDashboard size={17} /> },
  { id: 'orders', label: 'Orders & verification', icon: <ClipboardList size={17} /> },
  { id: 'warehouse', label: 'WMS & inbound', icon: <Warehouse size={17} /> },
  { id: 'picking', label: 'Pick & pack', icon: <Boxes size={17} /> },
  { id: 'dispatch', label: 'Dispatch', icon: <Truck size={17} /> },
  { id: 'exceptions', label: 'NDR exceptions', icon: <AlertTriangle size={17} /> },
  { id: 'returns', label: 'Returns', icon: <RotateCcw size={17} /> },
  { id: 'finance', label: 'Finance', icon: <CircleDollarSign size={17} /> },
  { id: 'setup', label: 'Merchants & fleet', icon: <Settings size={17} /> },
];

const tabPermissions: Record<Tab, string[]> = {
  overview: ['control_tower.view'],
  orders: ['order.view'],
  warehouse: ['inventory.view', 'inventory.locations.view'],
  picking: ['inventory.pick', 'inventory.pack'],
  dispatch: ['dispatch.view'],
  exceptions: ['ndr.view', 'audit.view'],
  returns: ['return.view'],
  finance: ['finance.view', 'finance.reconcile', 'finance.variance.approve'],
  setup: ['merchant.manage', 'rider.manage', 'product.manage'],
};

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(api.session);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadIssues, setLoadIssues] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exceptions, setExceptions] = useState<SystemException[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<InventoryStockSummary[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [transactions, setTransactions] = useState<Array<Record<string, unknown>>>([]);
  const [inbound, setInbound] = useState<InboundShipment[]>([]);
  const [waves, setWaves] = useState<PickWave[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [manifests, setManifests] = useState<DispatchManifest[]>([]);
  const [riders, setRiders] = useState<ApiRider[]>([]);
  const [ndr, setNdr] = useState<NDRCase[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [shifts, setShifts] = useState<RiderShiftReconciliation[]>([]);
  const [ledgers, setLedgers] = useState<MerchantLedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedReturnOrderId, setSelectedReturnOrderId] = useState('');
  const [selectedReturnProductId, setSelectedReturnProductId] = useState('');
  const [scanBarcode, setScanBarcode] = useState('');
  const [scanRouteId, setScanRouteId] = useState('');
  const [scanManifestId, setScanManifestId] = useState('');

  const loadData = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    const issues: string[] = [];
    const load = async <T,>(name: string, path: string, permission: string | string[], apply: (value: T) => void) => {
      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      if (!requiredPermissions.some((required) => session.user.permissions.includes(required))) return;
      try {
        apply(await api.request<T>(path));
      } catch (cause) {
        issues.push(`${name}: ${cause instanceof Error ? cause.message : 'request failed'}`);
      }
    };
    await Promise.all([
      load<Summary>('Control tower', '/control-tower/summary', 'control_tower.view', setSummary),
      load<SystemException[]>('Exceptions', '/exceptions', 'audit.view', setExceptions),
      load<Order[]>('Orders', '/orders', 'order.view', setOrders),
      load<InventoryStockSummary[]>('Inventory', '/inventory/stock', 'inventory.view', setStock),
      load<WarehouseLocation[]>('Locations', '/inventory/locations', 'inventory.locations.view', setLocations),
      load<Array<Record<string, unknown>>>('Inventory transactions', '/inventory/transactions', 'inventory.view', setTransactions),
      load<InboundShipment[]>('Inbound', '/inbound', 'inventory.view', setInbound),
      load<PickWave[]>('Pick waves', '/fulfillment/waves', 'inventory.pick', setWaves),
      load<RouteInfo[]>('Delivery routes', '/dispatch/routes', 'dispatch.view', setRoutes),
      load<DispatchManifest[]>('Manifests', '/dispatch/manifests', 'dispatch.view', setManifests),
      load<ApiRider[]>('Riders', '/riders', 'rider.view', setRiders),
      load<NDRCase[]>('NDR', '/ndr', 'ndr.view', setNdr),
      load<ReturnRecord[]>('Returns', '/returns', 'return.view', setReturns),
      load<RiderShiftReconciliation[]>('Rider shifts', '/finance/rider-shifts', ['finance.reconcile', 'finance.variance.approve'], setShifts),
      load<MerchantLedgerEntry[]>('Merchant ledger', '/finance/ledgers', 'finance.view', setLedgers),
      load<MerchantSettlement[]>('Settlements', '/finance/settlements', 'finance.view', setSettlements),
      load<Merchant[]>('Merchants', '/merchants', 'merchant.manage', setMerchants),
      load<Product[]>('Products', '/products', 'inventory.view', setProducts),
    ]);
    setLoadIssues(issues);
    setBusy(false);
  }, [session]);

  function clearData() {
    setSummary(null);
    setExceptions([]);
    setOrders([]);
    setStock([]);
    setLocations([]);
    setTransactions([]);
    setInbound([]);
    setWaves([]);
    setRoutes([]);
    setManifests([]);
    setRiders([]);
    setNdr([]);
    setReturns([]);
    setShifts([]);
    setLedgers([]);
    setSettlements([]);
    setMerchants([]);
    setProducts([]);
    setLoadIssues([]);
    setSelectedOrders([]);
  }

  useEffect(() => {
    if (session) void loadData();
  }, [session, loadData]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.login(email, password);
      if (result.user.roles.includes('RIDER') || result.user.merchantId) {
        await api.logout();
        throw new Error('Sign in with a Ship It operations or warehouse staff account.');
      }
      setActiveTab(tabs.find((tab) => tabPermissions[tab.id].some((permission) => result.user.permissions.includes(permission)))?.id ?? 'overview');
      setSession(result);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError('');
    try {
      await api.logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    } finally {
      setSession(null);
      clearData();
    }
  }

  async function perform(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadData();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function verifyOrder(orderId: string, isConfirmed: boolean) {
    await perform(() => api.request(`/orders/${encodeURIComponent(orderId)}/verify`, {
      method: 'POST', body: { isConfirmed, notes: isConfirmed ? 'Confirmed by operations' : 'Cancelled after verification' },
    }), isConfirmed ? 'Order verified and released to picking.' : 'Order cancelled.');
  }

  async function cancelOrder(orderId: string) {
    await perform(() => api.request(`/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST', body: { notes: 'Cancelled by operations' },
    }), 'Order cancelled and reserved stock released.');
  }

  async function scanParcel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const route = routes.find((item) => item.id === scanRouteId);
    if (!route) return setError('Select a route before scanning a parcel.');
    await perform(async () => {
      const result = await api.request<{ valid: boolean; message?: string; correctRouteCode?: string }>('/dispatch/scan-waybill', {
        method: 'POST',
        body: { barcode: scanBarcode.trim(), targetRouteCode: route.routeCode, ...(scanManifestId ? { manifestId: scanManifestId } : {}) },
      });
      if (!result.valid) throw new Error(result.message ?? `Parcel route mismatch${result.correctRouteCode ? `: ${result.correctRouteCode}` : ''}.`);
      setScanBarcode('');
      return result;
    }, 'Parcel validated and assigned to the selected manifest.');
  }

  async function createWave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrders.length) return setError('Select at least one ready-to-pick order.');
    if (await perform(() => api.request('/fulfillment/waves', { method: 'POST', body: { orderIds: selectedOrders } }), 'Pick wave created.')) {
      setSelectedOrders([]);
    }
  }

  async function markPicked(event: React.FormEvent<HTMLFormElement>, wave: PickWave, task: PickTask) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() => api.request('/fulfillment/pick', {
      method: 'POST',
      body: {
        orderId: task.orderId,
        allocationId: task.allocationId,
        pickTaskId: task.id,
        scannedBarcode: String(form.get('scannedBarcode')),
        quantity: Number(form.get('quantity')),
      },
    }), `${task.sku} pick confirmed for ${task.orderNumber}.`);
  }

  async function packOrder(order: Order) {
    const barcodes = order.items.flatMap((item) => {
      const barcode = products.find((product) => product.id === item.productId)?.barcode;
      return barcode ? Array.from({ length: item.quantity }, () => barcode) : [];
    });
    if (barcodes.length !== order.items.reduce((sum, item) => sum + item.quantity, 0)) {
      return setError(`Product barcodes are missing for ${order.orderNumber}.`);
    }
    await perform(() => api.request('/fulfillment/pack', {
      method: 'POST', body: { orderId: order.id, scannedProductBarcodes: barcodes },
    }), `${order.orderNumber} packed and waybill generated.`);
  }

  async function createManifest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() => api.request('/dispatch/manifests', {
      method: 'POST', body: { routeId: String(form.get('routeId')), riderId: String(form.get('riderId')) },
    }), 'Staged dispatch manifest created.');
  }

  async function handover(manifest: DispatchManifest) {
    await perform(() => api.request(`/dispatch/manifests/${encodeURIComponent(manifest.id)}/handover`, {
      method: 'POST',
      body: { acceptedParcelCount: manifest.totalParcels, acceptedCodTotalKes: manifest.expectedCodTotalKes },
    }), `${manifest.manifestNumber} handed over to ${manifest.riderName}.`);
  }

  async function resolveNdr(event: React.FormEvent<HTMLFormElement>, record: NDRCase) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() => api.request(`/ndr/${encodeURIComponent(record.id)}/resolve`, {
      method: 'POST', body: { resolution: String(form.get('resolution')), notes: String(form.get('notes')) },
    }), `Resolution recorded for ${record.orderNumber}.`);
  }

  async function createReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const order = orders.find((item) => item.id === String(form.get('orderId')));
    const productId = String(form.get('productId'));
    if (!order || !productId) return setError('Choose an order and product.');
    await perform(() => api.request('/returns', {
      method: 'POST',
      body: {
        orderId: order.id,
        returnType: String(form.get('returnType')),
        reason: String(form.get('reason')),
        items: [{ productId, quantity: Number(form.get('quantity')) }],
      },
    }), 'Return case opened.');
  }

  async function receiveReturn(event: React.FormEvent<HTMLFormElement>, record: ReturnRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = record.items.map((item) => {
      const receivedUnits = Number(form.get(`received-${item.id}`));
      const locationId = String(form.get(`location-${item.id}`) || '');
      return {
        productId: item.productId,
        receivedUnits,
        ...(receivedUnits > 0 && locationId ? { locationId } : {}),
      };
    });
    if (items.some((item) => item.receivedUnits > 0 && !item.locationId)) {
      return setError('Choose an active quarantine location for every item received.');
    }
    await perform(() => api.request(`/returns/${encodeURIComponent(record.id)}/receive`, {
      method: 'POST',
      body: { items },
    }), `${record.returnNumber} received into quarantine.`);
  }

  async function inspectReturn(event: React.FormEvent<HTMLFormElement>, record: ReturnRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let missingSelection = '';
    const items = record.items.flatMap((item) => {
      const quantity = Number(form.get(`inspect-${item.id}`));
      if (quantity <= 0) return [];
      const conditionGrade = String(form.get(`grade-${item.id}`));
      const action = String(form.get(`action-${item.id}`));
      if (!conditionGrade || !action) {
        missingSelection = item.product.sku;
        return [];
      }
      return [{ productId: item.productId, quantity, conditionGrade, action, photos: [] }];
    });
    if (missingSelection) return setError(`Choose a condition grade and action for ${missingSelection}.`);
    if (!items.length) return setError('There are no uninspected received units in this return.');
    await perform(() => api.request(`/returns/${encodeURIComponent(record.id)}/inspect`, { method: 'POST', body: { items } }), `${record.returnNumber} inspection recorded.`);
  }

  async function createMerchant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request<Merchant>('/merchants', {
      method: 'POST',
      body: {
        code: String(form.get('code')), name: String(form.get('name')),
        contactEmail: String(form.get('contactEmail')), contactPhone: String(form.get('contactPhone')),
      },
    }), 'Merchant account created in onboarding status.')) formElement.reset();
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request('/products', {
      method: 'POST',
      body: {
        merchantId: String(form.get('merchantId')), sku: String(form.get('sku')),
        barcode: String(form.get('barcode')), name: String(form.get('name')),
        declaredValueKes: Number(form.get('declaredValueKes')), weightKg: Number(form.get('weightKg')),
        reorderThreshold: Number(form.get('reorderThreshold') || 0),
        isFragile: form.get('isFragile') === 'on',
        requiresColdStorage: form.get('requiresColdStorage') === 'on',
      },
    }), 'Product added to the merchant catalog.')) formElement.reset();
  }

  async function createRider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request('/riders', {
      method: 'POST',
      body: {
        email: String(form.get('email')), password: String(form.get('password')),
        phoneNumber: String(form.get('phoneNumber')), firstName: String(form.get('firstName')),
        lastName: String(form.get('lastName')), nationalIdNumber: String(form.get('nationalIdNumber')),
        vehicleRegPlate: String(form.get('vehicleRegPlate')),
      },
    }), 'Rider account created.')) formElement.reset();
  }

  async function addMerchantUser(event: React.FormEvent<HTMLFormElement>, merchantId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request(`/merchants/${encodeURIComponent(merchantId)}/users`, {
      method: 'POST',
      body: {
        email: String(form.get('email')), password: String(form.get('password')),
        phoneNumber: String(form.get('phoneNumber')), firstName: String(form.get('firstName')),
        lastName: String(form.get('lastName')), role: String(form.get('role')),
      },
    }), 'Merchant user account created.')) formElement.reset();
  }

  async function submitInbound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request('/inbound', {
      method: 'POST',
      body: {
        merchantId: String(form.get('merchantId')), warehouseId: String(form.get('warehouseId')),
        expectedDeliveryDate: String(form.get('expectedDeliveryDate')), notes: String(form.get('notes') || ''),
        items: [{ productId: String(form.get('productId')), expectedUnits: Number(form.get('expectedUnits')) }],
      },
    }), 'Inbound ASN created.')) formElement.reset();
  }

  async function receiveInbound(event: React.FormEvent<HTMLFormElement>, shipment: InboundShipment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const locationId = String(form.get('locationId'));
    const items = shipment.items.map((item) => ({
      inboundItemId: item.id,
      receivedUnits: Number(form.get(`received-${item.id}`)),
      damagedUnits: Number(form.get(`damaged-${item.id}`) || 0),
      locationId,
    }));
    await perform(() => api.request(`/inbound/${encodeURIComponent(shipment.id)}/receive`, { method: 'POST', body: { items } }), `${shipment.asnNumber} receipt recorded.`);
  }

  async function adjustInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (await perform(() => api.request('/inventory/adjust', {
      method: 'POST',
      body: {
        productId: String(form.get('productId')), locationId: String(form.get('locationId')),
        deltaAvailable: Number(form.get('deltaAvailable')), deltaDamaged: Number(form.get('deltaDamaged') || 0),
        deltaQuarantine: Number(form.get('deltaQuarantine') || 0), reasonCode: String(form.get('reasonCode')),
      },
    }), 'Inventory adjustment posted to the immutable stock ledger.')) formElement.reset();
  }

  async function createSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() => api.request('/finance/settlements', {
      method: 'POST',
      body: {
        merchantId: String(form.get('merchantId')),
        periodStart: String(form.get('periodStart')), periodEnd: String(form.get('periodEnd')),
      },
    }), 'Settlement drafted from eligible unreconciled ledger entries.');
  }

  async function closeShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const succeeded = await perform(() => api.request('/finance/rider-shifts/closeout', {
      method: 'POST',
      body: {
        riderId: String(form.get('riderId')), shiftDate: String(form.get('shiftDate')),
        cashHandedInKes: Number(form.get('cashHandedInKes')), varianceNotes: String(form.get('varianceNotes') || ''),
      },
    }), 'Rider shift reconciled and closed.');
    if (!succeeded) await loadData();
  }

  async function approveShiftVariance(event: React.FormEvent<HTMLFormElement>, shiftId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(() => api.request(`/finance/rider-shifts/${encodeURIComponent(shiftId)}/approve-variance`, {
      method: 'POST',
      body: { approvalNotes: String(form.get('approvalNotes')) },
    }), 'Cash variance approved and rider shift closed.');
  }

  async function importOrders(file?: File) {
    if (!file) return;
    await perform(async () => api.requestText('/orders/import', await file.text()), 'CSV order import completed.');
  }

  if (!session) {
    return (
      <main className="staff-login">
        <form className="staff-login-card" onSubmit={(event) => void signIn(event)}>
          <div className="logo-badge">S</div><span className="staff-eyebrow">SHIP IT · OPERATIONS</span>
          <h1>Operations sign in</h1><p>Access live warehouse, dispatch, delivery and finance workflows.</p>
          {error && <Alert variant="error">{error}</Alert>}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    );
  }

  const kpis = summary?.kpis;
  const filteredOrders = orders.filter((order) =>
    `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.waybillNumber ?? ''}`
      .toLowerCase().includes(orderSearch.toLowerCase()),
  );
  const returnableOrders = orders.filter((order) => ['DELIVERED', 'RETURN_IN_TRANSIT'].includes(order.status));
  const selectedReturnOrder = returnableOrders.find((order) => order.id === selectedReturnOrderId) ?? returnableOrders[0];
  const selectedReturnProduct = selectedReturnOrder?.items.find((item) => item.productId === selectedReturnProductId) ?? selectedReturnOrder?.items[0];
  const warehouses = [...new Map(locations.map((location) => [location.warehouseId, location])).values()];
  const storageLocations = locations.filter((location) => location.zone !== 'QUARANTINE');
  const quarantineLocations = locations.filter((location) => location.zone === 'QUARANTINE');
  const can = (permission: string) => session.user.permissions.includes(permission);
  const visibleTabs = tabs.filter((tab) => tabPermissions[tab.id].some((permission) => can(permission)));

  return (
    <div className="staff-app">
      <aside className="staff-sidebar">
        <div className="staff-brand"><div className="logo-badge">S</div><div><strong>Ship It</strong><span>Fulfillment OS</span></div></div>
        <nav className="staff-nav">{visibleTabs.map((tab) => <button key={tab.id} className={`staff-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.icon}<span>{tab.label}</span>{tab.id === 'exceptions' && ndr.length > 0 && <b>{ndr.length}</b>}</button>)}</nav>
        <div className="staff-account"><div className="staff-account-avatar">{session.user.firstName.slice(0, 1)}{session.user.lastName.slice(0, 1)}</div><div className="staff-account-name"><strong>{session.user.firstName} {session.user.lastName}</strong><span>{session.user.roles.join(', ')}</span></div><button className="icon-button" onClick={() => void signOut()} title="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <div className="staff-main">
        <header className="staff-header"><div><span>OPERATIONS WORKSPACE</span><h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1></div><div className="header-right"><div className="connection-indicator"><span /> API-connected</div><button className="icon-button" onClick={() => void loadData()} disabled={busy} title="Refresh all data"><RefreshCw size={16} className={busy ? 'spinning' : ''} /></button></div></header>
        <main className="staff-content">
          {error && <Alert variant="error">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          {loadIssues.length > 0 && <Alert variant="warning"><strong>Some data could not be loaded:</strong> {loadIssues.join(' · ')}</Alert>}

          {activeTab === 'overview' && (
            <>
              <div className="welcome-banner"><div><span className="staff-eyebrow">LIVE OPERATIONS</span><h2>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {session.user.firstName}</h2><p>Control tower metrics and active exceptions from the production API.</p></div><button className="btn btn-secondary" onClick={() => void loadData()} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
              <div className="staff-kpi-grid">
                <Metric label="Orders today" value={kpis?.totalOrdersToday ?? '—'} icon={<ClipboardList />} />
                <Metric label="Pending verification" value={kpis?.pendingVerification ?? '—'} icon={<ShieldAlert />} />
                <Metric label="Ready to pick" value={kpis?.readyToPick ?? '—'} icon={<Package />} />
                <Metric label="Out for delivery" value={kpis?.outForDelivery ?? '—'} icon={<Truck />} />
                <Metric label="Delivered today" value={kpis?.delivered ?? '—'} icon={<CheckCircle2 />} />
                <Metric label="Open NDR cases" value={kpis?.ndrExceptions ?? '—'} icon={<AlertTriangle />} />
                <Metric label="COD collected" value={kpis ? currency(kpis.totalCodCollectedKes) : '—'} icon={<CircleDollarSign />} />
                <Metric label="Delivery success" value={kpis ? `${kpis.deliverySuccessRatePct}%` : '—'} icon={<Check />} />
              </div>
              {can('audit.view') && <Panel title={`Active operational exceptions (${exceptions.length})`} subtitle="Exception data is read from inventory, delivery, finance and returns services.">
                {exceptions.length === 0 ? <Empty>No active exceptions.</Empty> : <div className="exception-list">{exceptions.map((item) => <div className="exception-row" key={item.id}><div className="severity-icon"><AlertTriangle size={17} /></div><div className="exception-copy"><strong>{item.title}</strong><p>{item.details}</p><small>{item.category} · {new Date(item.createdAt).toLocaleString()}</small></div><span className={`severity severity-${item.severity.toLowerCase()}`}>{item.severity}</span></div>)}</div>}
              </Panel>}
              <div className="staff-two-col">
                <Panel title="Order pipeline"><Pipeline label="Verification" count={kpis?.pendingVerification ?? 0} color="amber" /><Pipeline label="Ready to pick" count={kpis?.readyToPick ?? 0} color="blue" /><Pipeline label="Packed" count={kpis?.packed ?? 0} color="cyan" /><Pipeline label="Out for delivery" count={kpis?.outForDelivery ?? 0} color="green" /></Panel>
                <Panel title="API health"><div className="health-row"><span>Client session</span><Status value="AUTHENTICATED" /></div><div className="health-row"><span>Data refresh</span><strong>{busy ? 'In progress…' : loadIssues.length ? 'Partial' : 'Ready'}</strong></div><div className="health-row"><span>Authenticated user</span><strong>{session.user.email}</strong></div></Panel>
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <>
              <Panel title="Order verification queue" subtitle="Only pending COD verification orders can be confirmed or cancelled.">
                <OrderTable orders={orders.filter((order) => order.status === 'PENDING_VERIFICATION')} can={can} onVerify={verifyOrder} onCancel={cancelOrder} onPack={packOrder} />
              </Panel>
              <Panel title="All orders" action={<div className="search-input"><input placeholder="Search order, waybill or customer" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /></div>}>
                <OrderTable orders={filteredOrders} can={can} onVerify={verifyOrder} onCancel={cancelOrder} onPack={packOrder} />
              </Panel>
              {can('order.create') && <Panel title="Bulk CSV import" subtitle="Imports CSV order rows through the validated backend import service.">
                <label className="file-picker"><FileUp size={17} /> Select order CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void importOrders(event.target.files?.[0])} /></label>
              </Panel>}
            </>
          )}

          {activeTab === 'warehouse' && (
            <>
              <div className="staff-two-col">
                {can('inventory.view') && <Panel title="Current stock" subtitle="Balances calculated from append-only inventory transactions.">
                  <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Available</th><th>Reserved</th><th>Damaged</th><th>Quarantine</th></tr></thead><tbody>{stock.map((item) => <tr key={item.productId}><td><code>{item.sku}</code></td><td>{item.productName}</td><td>{item.availableQty}</td><td>{item.reservedQty}</td><td>{item.damagedQty}</td><td>{item.quarantineQty}</td></tr>)}</tbody></table></div>
                </Panel>}
                {can('inventory.adjust') && <Panel title="Adjust stock" subtitle="All adjustments require a reason and are audit logged.">
                  <form className="staff-form" onSubmit={(event) => void adjustInventory(event)}>
                    <label>Product<select name="productId" required>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
                    <label>Location<select name="locationId" required>{storageLocations.map((location) => <option key={location.id} value={location.id}>{location.barcode} · {location.zone}</option>)}</select></label>
                    <div className="form-three"><label>Available Δ<input name="deltaAvailable" type="number" defaultValue="0" required /></label><label>Damaged Δ<input name="deltaDamaged" type="number" defaultValue="0" /></label><label>Quarantine Δ<input name="deltaQuarantine" type="number" defaultValue="0" /></label></div>
                    <label>Reason<input name="reasonCode" minLength={3} required /></label><button className="btn btn-primary" disabled={busy}>Post adjustment</button>
                  </form>
                </Panel>}
              </div>
              {can('inbound.create') && <Panel title="Schedule inbound shipment (ASN)">
                <form className="staff-form form-row" onSubmit={(event) => void submitInbound(event)}>
                  <label>Merchant<select name="merchantId" required>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label>
                  <label>Warehouse<select name="warehouseId" required>{warehouses.map((location) => <option key={location.warehouseId} value={location.warehouseId}>{location.warehouseId}</option>)}</select></label>
                  <label>Product<select name="productId" required>{products.map((product) => <option key={product.id} value={product.id}>{product.sku}</option>)}</select></label>
                  <label>Expected units<input name="expectedUnits" type="number" min="1" required /></label>
                  <label>Expected date<input name="expectedDeliveryDate" type="date" min={today()} required /></label>
                  <label>Notes<input name="notes" /></label><button className="btn btn-primary">Create ASN</button>
                </form>
              </Panel>}
              {can('inventory.view') && <Panel title="Inbound receiving queue">
                {inbound.map((shipment) => <details className="record-card" key={shipment.id}><summary><strong>{shipment.asnNumber}</strong><Status value={shipment.status} /><span>{shipment.items.length} products · expected {new Date(shipment.expectedDeliveryDate).toLocaleDateString()}</span><ChevronRight size={16} /></summary>{can('inventory.receive') && <form className="staff-form" onSubmit={(event) => void receiveInbound(event, shipment)}><div className="table-wrap"><table><thead><tr><th>Product</th><th>Expected</th><th>Received</th><th>Damaged</th></tr></thead><tbody>{shipment.items.map((item) => <tr key={item.id}><td>{products.find((product) => product.id === item.productId)?.sku ?? item.productId}</td><td>{item.expectedUnits - item.receivedUnits}</td><td><input name={`received-${item.id}`} type="number" min="0" max={item.expectedUnits - item.receivedUnits} defaultValue={item.expectedUnits - item.receivedUnits} required /></td><td><input name={`damaged-${item.id}`} type="number" min="0" defaultValue="0" /></td></tr>)}</tbody></table></div><label>Storage location<select name="locationId" required>{storageLocations.map((location) => <option key={location.id} value={location.id}>{location.barcode} · {location.zone}</option>)}</select></label><button className="btn btn-primary" disabled={busy}>Record receipt</button></form>}</details>)}
                {inbound.length === 0 && <Empty>No inbound ASNs.</Empty>}
              </Panel>}
              {can('inventory.locations.view') && <Panel title="Warehouse locations"><div className="location-grid">{locations.map((location) => <div className="location-chip" key={location.id}><code>{location.barcode}</code><span>{location.zone}</span><Status value={location.isOccupied ? 'OCCUPIED' : 'AVAILABLE'} /></div>)}</div></Panel>}
              {can('inventory.view') && <Panel title="Recent inventory ledger"><RecordsTable records={transactions.slice(0, 30)} /></Panel>}
            </>
          )}

          {activeTab === 'picking' && (
            <>
              {can('inventory.pick') && <Panel title="Create pick wave" subtitle="Select ready-to-pick orders with allocated inventory.">
                <form className="staff-form" onSubmit={(event) => void createWave(event)}>
                  <div className="select-order-grid">{orders.filter((order) => order.status === 'READY_FOR_PICK').map((order) => <label key={order.id} className="select-order"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={(event) => setSelectedOrders((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /><span><strong>{order.orderNumber}</strong><small>{order.customerName} · {order.items.length} lines</small></span></label>)}</div>
                  <button className="btn btn-primary" disabled={busy || !selectedOrders.length}><Plus size={15} /> Create wave ({selectedOrders.length})</button>
                </form>
              </Panel>}
              {waves.map((wave) => <Panel key={wave.id} title={`${wave.waveNumber} · ${wave.status}`} action={<div className="header-right"><Status value={wave.status} />{wave.status === 'CREATED' && <button className="btn btn-secondary btn-sm" onClick={() => void perform(() => api.request(`/fulfillment/waves/${encodeURIComponent(wave.id)}/start`, { method: 'POST' }), 'Pick wave started.')}>Start wave</button>}{wave.status === 'IN_PROGRESS' && wave.confirmedTaskCount === wave.taskCount && <button className="btn btn-primary btn-sm" onClick={() => void perform(() => api.request(`/fulfillment/waves/${encodeURIComponent(wave.id)}/complete`, { method: 'POST' }), 'Pick wave completed.')}>Complete wave</button>}</div>}>
                <div className="task-list">{wave.tasks.map((task) => <div className={`pick-task ${task.isConfirmed ? 'confirmed' : ''}`} key={task.id}><div className="task-location"><span>Pick location</span><code>{task.location.barcode}</code></div><div className="task-detail"><strong>{task.sku} · {task.productName}</strong><span>{task.orderNumber} · {task.quantity} units</span><code>Product barcode: {task.barcode}</code></div>{task.isConfirmed ? <Status value="PICKED" /> : wave.status === 'IN_PROGRESS' ? <form className="pick-task-form" onSubmit={(event) => void markPicked(event, wave, task)}><input name="scannedBarcode" placeholder="Scan product barcode" autoComplete="off" required /><input name="quantity" type="number" min="1" max={task.quantity - task.pickedQuantity} defaultValue={task.quantity - task.pickedQuantity} required /><button className="btn btn-primary btn-sm" disabled={busy}>Confirm pick</button></form> : <Status value="WAITING" />}</div>)}</div>
              </Panel>)}
              {can('inventory.pack') && <Panel title="Pack picked orders"><OrderTable orders={orders.filter((order) => order.status === 'PICKING')} can={can} onVerify={verifyOrder} onCancel={cancelOrder} onPack={packOrder} /></Panel>}
            </>
          )}

          {activeTab === 'dispatch' && (
            <>
              {can('dispatch.manifest') && <Panel title="Create route manifest" subtitle="Create a staged manifest for one route and rider, then scan packed parcels into it.">
                <form className="staff-form form-row" onSubmit={(event) => void createManifest(event)}><label>Route<select name="routeId" required>{routes.map((route) => <option key={route.id} value={route.id}>{route.routeCode} · {route.name}</option>)}</select></label><label>Rider<select name="riderId" required>{riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name} · {rider.vehiclePlate}</option>)}</select></label><button className="btn btn-primary"><Plus size={15} /> Create staged manifest</button></form>
              </Panel>}
              {can('dispatch.scan') && <Panel title="Waybill route scan" subtitle="The backend blocks scans that do not match the selected route or manifest.">
                <form className="staff-form form-row" onSubmit={(event) => void scanParcel(event)}><label>Delivery route<select value={scanRouteId} onChange={(event) => setScanRouteId(event.target.value)} required><option value="">Choose a route</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.routeCode}</option>)}</select></label><label>Staged manifest<select value={scanManifestId} onChange={(event) => setScanManifestId(event.target.value)}><option value="">Route validation only</option>{manifests.filter((manifest) => manifest.status === 'STAGED').map((manifest) => <option key={manifest.id} value={manifest.id}>{manifest.manifestNumber} · {manifest.routeCode}</option>)}</select></label><label>Waybill / order barcode<input value={scanBarcode} onChange={(event) => setScanBarcode(event.target.value)} required autoComplete="off" /></label><button className="btn btn-primary" disabled={busy}><Barcode size={16} /> Validate scan</button></form>
              </Panel>}
              <Panel title="Dispatch manifests"><div className="table-wrap"><table><thead><tr><th>Manifest</th><th>Route</th><th>Rider</th><th>Parcels</th><th>Expected COD</th><th>Status</th><th>Action</th></tr></thead><tbody>{manifests.map((manifest) => <tr key={manifest.id}><td><code>{manifest.manifestNumber}</code></td><td>{manifest.routeCode}</td><td>{manifest.riderName}</td><td>{manifest.totalParcels}</td><td>{currency(manifest.expectedCodTotalKes)}</td><td><Status value={manifest.status} /></td><td>{can('dispatch.handover') && manifest.status === 'STAGED' && manifest.totalParcels > 0 && <button className="btn btn-secondary btn-sm" onClick={() => void handover(manifest)}>Confirm custody handover</button>}</td></tr>)}</tbody></table></div></Panel>
            </>
          )}

          {activeTab === 'exceptions' && (
            <>
              {can('ndr.view') && <Panel title={`Non-delivery cases (${ndr.length})`} subtitle="Resolve an NDR to retry delivery or return the parcel to origin.">
                {ndr.length === 0 ? <Empty>No open NDR cases.</Empty> : <div className="exception-list">{ndr.map((record) => <div className="ndr-card" key={record.id}><div><strong>{record.orderNumber} · {record.customerName}</strong><p>{record.failureReason.replaceAll('_', ' ')} · {record.area} · Rider {record.riderName}</p><small>{record.customerPhone} · {new Date(record.createdAt).toLocaleString()}</small></div>{can('ndr.resolve') && <form className="ndr-card" onSubmit={(event) => void resolveNdr(event, record)}><select name="resolution"><option value="RETRY">Retry delivery</option><option value="RTO">Return to origin</option></select><input name="notes" placeholder="Resolution notes" minLength={3} required /><button className="btn btn-primary btn-sm" disabled={busy}>Resolve</button></form>}</div>)}</div>}
              </Panel>}
              {can('audit.view') && <Panel title="All active exceptions" subtitle="This list is generated by inventory, delivery, finance and return services.">
                {exceptions.map((record) => <div className="exception-row" key={record.id}><div className="exception-copy"><strong>{record.title}</strong><p>{record.details}</p><small>{record.category} · {record.entityType} · {new Date(record.createdAt).toLocaleString()}</small></div><Status value={record.severity} /></div>)}
              </Panel>}
            </>
          )}

          {activeTab === 'returns' && (
            <>
              {can('return.manage') && <Panel title="Initiate a return" subtitle="Customer returns require a delivered order; immediate RTO requires prior NDR resolution.">
                <form className="staff-form form-row" onSubmit={(event) => void createReturn(event)}><label>Order<select name="orderId" value={selectedReturnOrder?.id ?? ''} onChange={(event) => { const order = returnableOrders.find((item) => item.id === event.target.value); setSelectedReturnOrderId(event.target.value); setSelectedReturnProductId(order?.items[0]?.productId ?? ''); }} required>{returnableOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.status}</option>)}</select></label><label>Product<select name="productId" value={selectedReturnProduct?.productId ?? ''} onChange={(event) => setSelectedReturnProductId(event.target.value)} required>{selectedReturnOrder?.items.map((item) => <option key={item.productId} value={item.productId}>{item.sku} · {item.productName}</option>)}</select></label><label>Quantity<input key={selectedReturnProduct?.productId} name="quantity" type="number" min="1" max={selectedReturnProduct?.quantity ?? 1} defaultValue="1" required /></label><label>Type<select name="returnType"><option value="CUSTOMER_RETURN">Customer return</option><option value="IMMEDIATE_RTO">Immediate RTO</option></select></label><label>Reason<input name="reason" required minLength={3} /></label><button className="btn btn-primary"><Plus size={15} /> Open return</button></form>
              </Panel>}
              <Panel title="Return handling queue">
                <div className="table-wrap"><table><thead><tr><th>Return</th><th>Order</th><th>Type / reason</th><th>Items</th><th>Status</th><th>Action</th></tr></thead><tbody>{returns.map((record) => <tr key={record.id}><td><code>{record.returnNumber}</code></td><td>{record.order.orderNumber}</td><td>{record.returnType}<small>{record.reason}</small></td><td>{record.items.map((item) => `${item.product.sku} ${item.receivedUnits}/${item.expectedUnits}`).join(', ')}</td><td><Status value={record.status} /></td><td>{can('return.inspect') && ['RETURN_INITIATED', 'IN_TRANSIT'].includes(record.status) && <details><summary>Record receipt</summary><form className="staff-form" onSubmit={(event) => void receiveReturn(event, record)}>{record.items.map((item) => <div className="form-row" key={item.id}><label>{item.product.sku} received<input name={`received-${item.id}`} type="number" min="0" max={item.expectedUnits} required /></label><label>Quarantine location<select name={`location-${item.id}`} defaultValue=""><option value="">Choose location if received</option>{quarantineLocations.map((location) => <option key={location.id} value={location.id}>{location.barcode} · {location.zone}</option>)}</select></label></div>)}<button className="btn btn-secondary btn-sm" disabled={busy}>Record actual receipt</button></form></details>}{can('return.inspect') && record.status === 'RECEIVED_AT_WAREHOUSE' && <details><summary>Inspect received units</summary><form className="staff-form" onSubmit={(event) => void inspectReturn(event, record)}>{record.items.filter((item) => item.receivedUnits > item.inspectedUnits).map((item) => <div className="form-row" key={item.id}><label>{item.product.sku} quantity<input name={`inspect-${item.id}`} type="number" min="0" max={item.receivedUnits - item.inspectedUnits} defaultValue={item.receivedUnits - item.inspectedUnits} /></label><label>Condition<select name={`grade-${item.id}`} defaultValue=""><option value="">Choose grade</option><option value="GRADE_A_RESTOCKABLE">Grade A · restockable</option><option value="GRADE_B_DAMAGED_PACKAGING">Grade B · damaged packaging</option><option value="GRADE_C_DAMAGED_PRODUCT">Grade C · damaged product</option><option value="WRONG_ITEM_RETURNED">Wrong item returned</option></select></label><label>Action<select name={`action-${item.id}`} defaultValue=""><option value="">Choose action</option><option value="RESTOCKED_TO_AVAILABLE">Restock to available</option><option value="QUARANTINED">Keep quarantined</option><option value="RETURNED_TO_MERCHANT">Return to merchant</option></select></label></div>)}<button className="btn btn-secondary btn-sm" disabled={busy}>Save inspection</button></form></details>}</td></tr>)}</tbody></table></div>
              </Panel>
            </>
          )}

          {activeTab === 'finance' && (
            <>
              {can('finance.reconcile') && <Panel title="Rider shift closeout" subtitle="Cash variances remain locked unless a manager approves with a reason.">
                <form className="staff-form form-row" onSubmit={(event) => void closeShift(event)}><label>Rider<select name="riderId" required>{riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}</select></label><label>Shift date<input type="date" name="shiftDate" defaultValue={today()} required /></label><label>Cash handed in (KES)<input type="number" name="cashHandedInKes" min="0" required /></label><label>Variance reason<input name="varianceNotes" /></label><button className="btn btn-primary">Submit closeout</button></form>
              </Panel>}
              {(can('finance.reconcile') || can('finance.variance.approve')) && <Panel title="Rider reconciliation"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Rider</th><th>Expected COD</th><th>M-Pesa</th><th>Cash expected</th><th>Cash handed in</th><th>Variance</th><th>Status</th><th>Action</th></tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id}><td>{shift.shiftDate}</td><td>{shift.riderName}</td><td>{currency(shift.expectedCodKes)}</td><td>{currency(shift.mpesaCollectedKes)}</td><td>{currency(shift.expectedCashKes)}</td><td>{currency(shift.cashHandedInKes)}</td><td className={shift.varianceKes === 0 ? '' : 'negative'}>{currency(shift.varianceKes)}{shift.varianceNotes && <small>{shift.varianceNotes}</small>}</td><td><Status value={shift.isReconciled ? 'RECONCILED' : 'REQUIRES APPROVAL'} /></td><td>{!shift.isReconciled && shift.varianceKes !== 0 && can('finance.variance.approve') && <form className="staff-form" onSubmit={(event) => void approveShiftVariance(event, shift.id)}><label>Approval reason<input name="approvalNotes" minLength={3} maxLength={1000} required /></label><button className="btn btn-secondary btn-sm" disabled={busy}>Approve & close</button></form>}</td></tr>)}</tbody></table></div></Panel>}
              {can('settlement.create') && <Panel title="Create settlement"><form className="staff-form form-row" onSubmit={(event) => void createSettlement(event)}><label>Merchant<select name="merchantId" required>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label><label>Period start<input name="periodStart" type="date" required /></label><label>Period end<input name="periodEnd" type="date" required /></label><button className="btn btn-primary">Draft settlement</button></form></Panel>}
              {can('finance.view') && <Panel title="Settlement approvals & disbursements"><div className="table-wrap"><table><thead><tr><th>Settlement</th><th>Merchant</th><th>Gross COD</th><th>Fees</th><th>Net payout</th><th>Status</th><th>Actions</th></tr></thead><tbody>{settlements.map((settlement) => <tr key={settlement.id}><td><code>{settlement.settlementNumber}</code></td><td>{merchants.find((merchant) => merchant.id === settlement.merchantId)?.name ?? settlement.merchantId}</td><td>{currency(settlement.grossCodCollectedKes)}</td><td>{currency(settlement.totalFeesDeductedKes)}</td><td>{currency(settlement.netPayoutKes)}</td><td><Status value={settlement.status} /></td><td className="action-cell">{can('settlement.approve') && settlement.status === 'DRAFT' && <button className="btn btn-secondary btn-sm" onClick={() => void perform(() => api.request('/finance/settlements/approve', { method: 'POST', body: { settlementId: settlement.id } }), 'Settlement approved.')}>Approve</button>}{can('settlement.disburse') && settlement.status === 'APPROVED' && <><button className="btn btn-secondary btn-sm" onClick={() => void perform(() => api.request(`/finance/settlements/${encodeURIComponent(settlement.id)}/disburse`, { method: 'POST' }), 'M-Pesa B2C disbursement requested.')}>M-Pesa B2C</button><button className="btn btn-secondary btn-sm" onClick={() => { const reference = window.prompt('Enter payout reference'); if (reference) void perform(() => api.request(`/finance/settlements/${encodeURIComponent(settlement.id)}/paid`, { method: 'POST', body: { payoutReference: reference } }), 'Settlement marked paid.'); }}>Mark paid</button></>}</td></tr>)}</tbody></table></div></Panel>}
              {can('finance.view') && <Panel title="Merchant financial ledger"><RecordsTable records={ledgers.slice(0, 50) as unknown as Array<Record<string, unknown>>} /></Panel>}
            </>
          )}

          {activeTab === 'setup' && (
            <>
              <div className="staff-two-col">
                {can('merchant.manage') && <Panel title="Onboard merchant"><form className="staff-form" onSubmit={(event) => void createMerchant(event)}><label>Merchant code<input name="code" required /></label><label>Business name<input name="name" required /></label><label>Contact email<input name="contactEmail" type="email" required /></label><label>Contact phone<input name="contactPhone" type="tel" required placeholder="0712345678" /></label><button className="btn btn-primary">Create merchant</button></form></Panel>}
                {can('product.manage') && can('merchant.manage') && <Panel title="Add catalog product"><form className="staff-form" onSubmit={(event) => void createProduct(event)}><label>Merchant<select name="merchantId" required>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</select></label><label>SKU<input name="sku" required /></label><label>Barcode<input name="barcode" required /></label><label>Product name<input name="name" required /></label><div className="form-three"><label>Value (KES)<input name="declaredValueKes" type="number" min="0" required /></label><label>Weight (kg)<input name="weightKg" type="number" min="0" step="0.01" required /></label><label>Reorder level<input name="reorderThreshold" type="number" min="0" defaultValue="0" /></label></div><label className="check-label"><input name="isFragile" type="checkbox" /> Fragile</label><label className="check-label"><input name="requiresColdStorage" type="checkbox" /> Requires cold storage</label><button className="btn btn-primary">Create product</button></form></Panel>}
              </div>
              {can('merchant.manage') && <Panel title="Merchant onboarding status"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Merchant</th><th>Contact</th><th>Status</th><th>Activate account</th></tr></thead><tbody>{merchants.map((merchant) => <tr key={merchant.id}><td><code>{merchant.code}</code></td><td>{merchant.name}</td><td>{merchant.contactEmail}<small>{merchant.contactPhone}</small></td><td><Status value={merchant.status} /></td><td>{merchant.status !== 'ACTIVE' && <button className="btn btn-secondary btn-sm" onClick={() => void perform(() => api.request(`/merchants/${encodeURIComponent(merchant.id)}/activate`, { method: 'POST' }), 'Merchant activated.')}>Activate</button>}</td></tr>)}</tbody></table></div></Panel>}
              {can('merchant.manage') && <Panel title="Create merchant user"><div className="merchant-user-grid">{merchants.filter((merchant) => merchant.status === 'ACTIVE').map((merchant) => <form className="staff-form mini-form" key={merchant.id} onSubmit={(event) => void addMerchantUser(event, merchant.id)}><strong>{merchant.name}</strong><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phoneNumber" required /></label><label>Initial password<input name="password" type="password" minLength={12} required /></label><label>Role<select name="role"><option value="MERCHANT_ADMIN">Merchant admin</option><option value="MERCHANT_STAFF">Merchant staff</option></select></label><button className="btn btn-secondary">Create user</button></form>)}</div></Panel>}
              {can('rider.manage') && <Panel title="Register rider"><form className="staff-form form-row" onSubmit={(event) => void createRider(event)}><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phoneNumber" required /></label><label>National ID<input name="nationalIdNumber" required /></label><label>Vehicle plate<input name="vehicleRegPlate" required /></label><label>Initial password<input name="password" type="password" minLength={12} required /></label><button className="btn btn-primary"><Users size={15} /> Create rider</button></form></Panel>}
              {can('inventory.view') && <Panel title="Catalog products"><div className="table-wrap"><table><thead><tr><th>Merchant</th><th>SKU</th><th>Product</th><th>Barcode</th><th>Declared value</th><th>Weight</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{merchants.find((merchant) => merchant.id === product.merchantId)?.name ?? product.merchantId}</td><td><code>{product.sku}</code></td><td>{product.name}</td><td>{product.barcode}</td><td>{currency(product.declaredValueKes)}</td><td>{product.weightKg} kg</td></tr>)}</tbody></table></div></Panel>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Alert({ variant, children }: { variant: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  return <div className={`staff-alert ${variant}`} role="status">{children}</div>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="staff-panel"><header className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return <section className="staff-metric"><div className="metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong></section>;
}

function Pipeline({ label, count, color }: { label: string; count: number; color: string }) {
  return <div className="pipeline-row"><span className={`pipeline-dot ${color}`} /><span>{label}</span><strong>{count}</strong></div>;
}

function Status({ value }: { value: string }) {
  const tone = /FAILED|CANCEL|RTO|NOT_READY|HIGH/i.test(value) ? 'danger' : /PENDING|DRAFT|EXPECTED|WARNING|IN_PROGRESS/i.test(value) ? 'warning' : /DELIVER|ACTIVE|COMPLETED|RECONCILED|PICKED|AVAILABLE|AUTHENTICATED/i.test(value) ? 'success' : 'neutral';
  return <span className={`staff-status ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="staff-empty">{children}</div>;
}

function OrderTable({ orders, can, onVerify, onCancel, onPack }: {
  orders: Order[];
  can: (permission: string) => boolean;
  onVerify: (id: string, confirmed: boolean) => void;
  onCancel: (id: string) => void;
  onPack: (order: Order) => void;
}) {
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer / contact</th><th>Destination</th><th>Items</th><th>COD</th><th>Status</th><th>Actions</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><code>{order.orderNumber}</code>{order.waybillNumber && <small>{order.waybillNumber}</small>}</td><td>{order.customerName}<small>{order.customerPhone}</small></td><td>{order.address.townOrSubCounty}, {order.address.estateOrArea}<small>{order.address.landmark}</small></td><td>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td><td>{currency(order.codAmountExpectedKes)}</td><td><Status value={order.status} /></td><td className="action-cell">{can('order.verify') && order.status === 'PENDING_VERIFICATION' && <><button className="btn btn-secondary btn-sm" onClick={() => onVerify(order.id, true)}><Check size={14} /> Verify</button><button className="btn btn-danger btn-sm" onClick={() => onVerify(order.id, false)}><XCircle size={14} /> Reject</button></>}{can('order.cancel') && ['PENDING_VERIFICATION', 'READY_FOR_PICK'].includes(order.status) && <button className="btn btn-danger btn-sm" onClick={() => onCancel(order.id)}>Cancel</button>}{can('inventory.pack') && order.status === 'PICKING' && <button className="btn btn-secondary btn-sm" onClick={() => onPack(order)}>Pack</button>}</td></tr>)}{orders.length === 0 && <tr><td colSpan={7}><Empty>No matching orders.</Empty></td></tr>}</tbody></table></div>;
}

function RecordsTable({ records }: { records: Array<Record<string, unknown>> }) {
  if (!records.length) return <Empty>No ledger records.</Empty>;
  const columns = Object.keys(records[0]);
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={String(record.id ?? index)}>{columns.map((column) => <td key={column}>{record[column] instanceof Object ? JSON.stringify(record[column]) : String(record[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>;
}
