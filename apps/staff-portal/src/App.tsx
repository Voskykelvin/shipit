import React, { useCallback, useEffect, useState } from 'react';
import { api, type AuthSession } from '@shipit/api-client';
import type {
  DispatchManifest,
  InventoryStockSummary,
  MerchantLedgerEntry,
  MerchantSettlement,
  NDRCase,
  Order,
  RiderShiftReconciliation,
  SystemException,
  WarehouseLocation,
} from '@shipit/shared-types';
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  RotateCcw,
  Settings,
  Truck,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';

import type {
  ApiRider,
  InboundShipment,
  Merchant,
  PickTask,
  PickWave,
  Product,
  ReturnRecord,
  RouteInfo,
  Summary,
  Tab,
} from './types';
import { Alert } from './components/ui';
import { audioCues } from './utils/audio';
import { useLiveEvents, type LiveDomainEvent } from './utils/useLiveEvents';

import { ControlTowerView } from './features/control-tower/ControlTowerView';
import { OrdersView } from './features/orders/OrdersView';
import { WarehouseView } from './features/warehouse/WarehouseView';
import { PickingView } from './features/picking/PickingView';
import { DispatchView } from './features/dispatch/DispatchView';
import { ExceptionsView } from './features/exceptions/ExceptionsView';
import { ReturnsView } from './features/returns/ReturnsView';
import { FinanceView } from './features/finance/FinanceView';
import { SetupView } from './features/setup/SetupView';

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

  // Domain data
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

  // Interactive UI state
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
    const load = async <T,>(
      name: string,
      path: string,
      permission: string | string[],
      apply: (value: T) => void,
    ) => {
      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      if (!requiredPermissions.some((required) => session.user.permissions.includes(required))) {
        return;
      }
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

  const [liveAlert, setLiveAlert] = useState<{ title: string; message: string; orderId?: string } | null>(null);

  const handleLiveEvent = useCallback((event: LiveDomainEvent) => {
    if (event.type === 'ndr.created') {
      audioCues.playUrgentAlert();
      const reason = String(event.payload.failureReason ?? 'CUSTOMER_UNREACHABLE').replaceAll('_', ' ');
      setLiveAlert({
        title: 'URGENT NDR INTERCEPTION ALERT',
        message: `Order #${event.payload.orderId ?? event.entityId} delivery failed: ${reason}. Rider is still on site!`,
        orderId: String(event.payload.orderId ?? ''),
      });
      void loadData();
    } else if (event.type === 'delivery.completed') {
      audioCues.playSuccess();
      void loadData();
    } else if (['order.created', 'order.verified', 'order.cancelled', 'manifest.dispatched'].includes(event.type)) {
      void loadData();
    }
  }, [loadData]);

  const { status: liveStatus } = useLiveEvents(session?.token, handleLiveEvent);

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
      setActiveTab(
        tabs.find((tab) =>
          tabPermissions[tab.id].some((permission) => result.user.permissions.includes(permission)),
        )?.id ?? 'overview',
      );
      setSession(result);
      setPassword('');
      audioCues.playSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
      audioCues.playError();
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
      audioCues.playSuccess();
      await loadData();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request could not be completed.');
      audioCues.playError();
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Action handlers
  async function verifyOrder(orderId: string, isConfirmed: boolean) {
    await perform(
      () =>
        api.request(`/orders/${encodeURIComponent(orderId)}/verify`, {
          method: 'POST',
          body: {
            isConfirmed,
            notes: isConfirmed ? 'Confirmed by operations' : 'Cancelled after verification',
          },
        }),
      isConfirmed ? 'Order verified and released to picking.' : 'Order cancelled.',
    );
  }

  async function cancelOrder(orderId: string) {
    await perform(
      () =>
        api.request(`/orders/${encodeURIComponent(orderId)}/cancel`, {
          method: 'POST',
          body: { notes: 'Cancelled by operations' },
        }),
      'Order cancelled and reserved stock released.',
    );
  }

  async function scanParcel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const route = routes.find((item) => item.id === scanRouteId);
    if (!route) {
      audioCues.playError();
      return setError('Select a route before scanning a parcel.');
    }
    await perform(async () => {
      const result = await api.request<{
        valid: boolean;
        message?: string;
        correctRouteCode?: string;
      }>('/dispatch/scan-waybill', {
        method: 'POST',
        body: {
          barcode: scanBarcode.trim(),
          targetRouteCode: route.routeCode,
          ...(scanManifestId ? { manifestId: scanManifestId } : {}),
        },
      });
      if (!result.valid) {
        throw new Error(
          result.message ??
            `Parcel route mismatch${result.correctRouteCode ? `: ${result.correctRouteCode}` : ''}.`,
        );
      }
      setScanBarcode('');
      return result;
    }, 'Parcel validated and assigned to the selected manifest.');
  }

  async function createWave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrders.length) {
      audioCues.playError();
      return setError('Select at least one ready-to-pick order.');
    }
    if (
      await perform(
        () => api.request('/fulfillment/waves', { method: 'POST', body: { orderIds: selectedOrders } }),
        'Pick wave created.',
      )
    ) {
      setSelectedOrders([]);
    }
  }

  async function markPicked(event: React.FormEvent<HTMLFormElement>, task: PickTask) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      () =>
        api.request('/fulfillment/pick', {
          method: 'POST',
          body: {
            orderId: task.orderId,
            allocationId: task.allocationId,
            pickTaskId: task.id,
            scannedBarcode: String(form.get('scannedBarcode')),
            quantity: Number(form.get('quantity')),
          },
        }),
      `${task.sku} pick confirmed for ${task.orderNumber}.`,
    );
  }

  async function packOrder(order: Order) {
    const barcodes = order.items.flatMap((item) => {
      const barcode = products.find((product) => product.id === item.productId)?.barcode;
      return barcode ? Array.from({ length: item.quantity }, () => barcode) : [];
    });
    if (barcodes.length !== order.items.reduce((sum, item) => sum + item.quantity, 0)) {
      audioCues.playError();
      return setError(`Product barcodes are missing for ${order.orderNumber}.`);
    }
    await perform(
      () =>
        api.request('/fulfillment/pack', {
          method: 'POST',
          body: { orderId: order.id, scannedProductBarcodes: barcodes },
        }),
      `${order.orderNumber} packed and waybill generated.`,
    );
  }

  async function createManifest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      () =>
        api.request('/dispatch/manifests', {
          method: 'POST',
          body: { routeId: String(form.get('routeId')), riderId: String(form.get('riderId')) },
        }),
      'Staged dispatch manifest created.',
    );
  }

  async function handover(manifest: DispatchManifest) {
    await perform(
      () =>
        api.request(`/dispatch/manifests/${encodeURIComponent(manifest.id)}/handover`, {
          method: 'POST',
          body: {
            acceptedParcelCount: manifest.totalParcels,
            acceptedCodTotalKes: manifest.expectedCodTotalKes,
          },
        }),
      `${manifest.manifestNumber} handed over to ${manifest.riderName}.`,
    );
  }

  async function resolveNdr(event: React.FormEvent<HTMLFormElement>, record: NDRCase) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      () =>
        api.request(`/ndr/${encodeURIComponent(record.id)}/resolve`, {
          method: 'POST',
          body: {
            resolution: String(form.get('resolution')),
            notes: String(form.get('notes')),
          },
        }),
      `Resolution recorded for ${record.orderNumber}.`,
    );
  }

  async function createReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const order = orders.find((item) => item.id === String(form.get('orderId')));
    const productId = String(form.get('productId'));
    if (!order || !productId) {
      audioCues.playError();
      return setError('Choose an order and product.');
    }
    await perform(
      () =>
        api.request('/returns', {
          method: 'POST',
          body: {
            orderId: order.id,
            returnType: String(form.get('returnType')),
            reason: String(form.get('reason')),
            items: [{ productId, quantity: Number(form.get('quantity')) }],
          },
        }),
      'Return case opened.',
    );
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
      audioCues.playError();
      return setError('Choose an active quarantine location for every item received.');
    }
    await perform(
      () =>
        api.request(`/returns/${encodeURIComponent(record.id)}/receive`, {
          method: 'POST',
          body: { items },
        }),
      `${record.returnNumber} received into quarantine.`,
    );
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
    if (missingSelection) {
      audioCues.playError();
      return setError(`Choose a condition grade and action for ${missingSelection}.`);
    }
    if (!items.length) {
      audioCues.playError();
      return setError('There are no uninspected received units in this return.');
    }
    await perform(
      () =>
        api.request(`/returns/${encodeURIComponent(record.id)}/inspect`, {
          method: 'POST',
          body: { items },
        }),
      `${record.returnNumber} inspection recorded.`,
    );
  }

  async function createMerchant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request<Merchant>('/merchants', {
            method: 'POST',
            body: {
              code: String(form.get('code')),
              name: String(form.get('name')),
              contactEmail: String(form.get('contactEmail')),
              contactPhone: String(form.get('contactPhone')),
            },
          }),
        'Merchant account created in onboarding status.',
      )
    ) {
      formElement.reset();
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request('/products', {
            method: 'POST',
            body: {
              merchantId: String(form.get('merchantId')),
              sku: String(form.get('sku')),
              barcode: String(form.get('barcode')),
              name: String(form.get('name')),
              declaredValueKes: Number(form.get('declaredValueKes')),
              weightKg: Number(form.get('weightKg')),
              reorderThreshold: Number(form.get('reorderThreshold') || 0),
              isFragile: form.get('isFragile') === 'on',
              requiresColdStorage: form.get('requiresColdStorage') === 'on',
            },
          }),
        'Product added to the merchant catalog.',
      )
    ) {
      formElement.reset();
    }
  }

  async function createRider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request('/riders', {
            method: 'POST',
            body: {
              email: String(form.get('email')),
              password: String(form.get('password')),
              phoneNumber: String(form.get('phoneNumber')),
              firstName: String(form.get('firstName')),
              lastName: String(form.get('lastName')),
              nationalIdNumber: String(form.get('nationalIdNumber')),
              vehicleRegPlate: String(form.get('vehicleRegPlate')),
            },
          }),
        'Rider account created.',
      )
    ) {
      formElement.reset();
    }
  }

  async function addMerchantUser(event: React.FormEvent<HTMLFormElement>, merchantId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request(`/merchants/${encodeURIComponent(merchantId)}/users`, {
            method: 'POST',
            body: {
              email: String(form.get('email')),
              password: String(form.get('password')),
              phoneNumber: String(form.get('phoneNumber')),
              firstName: String(form.get('firstName')),
              lastName: String(form.get('lastName')),
              role: String(form.get('role')),
            },
          }),
        'Merchant user account created.',
      )
    ) {
      formElement.reset();
    }
  }

  async function submitInbound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request('/inbound', {
            method: 'POST',
            body: {
              merchantId: String(form.get('merchantId')),
              warehouseId: String(form.get('warehouseId')),
              expectedDeliveryDate: String(form.get('expectedDeliveryDate')),
              notes: String(form.get('notes') || ''),
              items: [
                {
                  productId: String(form.get('productId')),
                  expectedUnits: Number(form.get('expectedUnits')),
                },
              ],
            },
          }),
        'Inbound ASN created.',
      )
    ) {
      formElement.reset();
    }
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
    await perform(
      () =>
        api.request(`/inbound/${encodeURIComponent(shipment.id)}/receive`, {
          method: 'POST',
          body: { items },
        }),
      `${shipment.asnNumber} receipt recorded.`,
    );
  }

  async function adjustInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    if (
      await perform(
        () =>
          api.request('/inventory/adjust', {
            method: 'POST',
            body: {
              productId: String(form.get('productId')),
              locationId: String(form.get('locationId')),
              deltaAvailable: Number(form.get('deltaAvailable')),
              deltaDamaged: Number(form.get('deltaDamaged') || 0),
              deltaQuarantine: Number(form.get('deltaQuarantine') || 0),
              reasonCode: String(form.get('reasonCode')),
            },
          }),
        'Inventory adjustment posted to the immutable stock ledger.',
      )
    ) {
      formElement.reset();
    }
  }

  async function createSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      () =>
        api.request('/finance/settlements', {
          method: 'POST',
          body: {
            merchantId: String(form.get('merchantId')),
            periodStart: String(form.get('periodStart')),
            periodEnd: String(form.get('periodEnd')),
          },
        }),
      'Settlement drafted from eligible unreconciled ledger entries.',
    );
  }

  async function closeShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const succeeded = await perform(
      () =>
        api.request('/finance/rider-shifts/closeout', {
          method: 'POST',
          body: {
            riderId: String(form.get('riderId')),
            shiftDate: String(form.get('shiftDate')),
            cashHandedInKes: Number(form.get('cashHandedInKes')),
            varianceNotes: String(form.get('varianceNotes') || ''),
          },
        }),
      'Rider shift reconciled and closed.',
    );
    if (!succeeded) await loadData();
  }

  async function approveShiftVariance(event: React.FormEvent<HTMLFormElement>, shiftId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      () =>
        api.request(`/finance/rider-shifts/${encodeURIComponent(shiftId)}/approve-variance`, {
          method: 'POST',
          body: { approvalNotes: String(form.get('approvalNotes')) },
        }),
      'Cash variance approved and rider shift closed.',
    );
  }

  async function importOrders(file?: File) {
    if (!file) return;
    await perform(
      async () => api.requestText('/orders/import', await file.text()),
      'CSV order import completed.',
    );
  }

  async function sendNotification(
    recipientPhone: string,
    channel: 'SMS' | 'WHATSAPP',
    message: string,
    orderNumber?: string,
  ) {
    await perform(
      () =>
        api.request('/notifications/send', {
          method: 'POST',
          body: { recipientPhone, channel, message, orderNumber },
        }),
      `${channel} alert sent to ${recipientPhone}.`,
    );
  }

  if (!session) {
    return (
      <main className="staff-login">
        <form className="staff-login-card" onSubmit={(event) => void signIn(event)}>
          <div className="logo-badge">S</div>
          <span className="staff-eyebrow">SHIP IT · OPERATIONS</span>
          <h1>Operations sign in</h1>
          <p>Access live warehouse, dispatch, delivery and finance workflows.</p>
          {error && <Alert variant="error">{error}</Alert>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  const can = (permission: string) => session.user.permissions.includes(permission);
  const visibleTabs = tabs.filter((tab) =>
    tabPermissions[tab.id].some((permission) => can(permission)),
  );

  return (
    <div className="staff-app">
      <aside className="staff-sidebar">
        <div className="staff-brand">
          <div className="logo-badge">S</div>
          <div>
            <strong>Ship It</strong>
            <span>Fulfillment OS</span>
          </div>
        </div>
        <nav className="staff-nav">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              className={`staff-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'exceptions' && ndr.length > 0 && <b>{ndr.length}</b>}
            </button>
          ))}
        </nav>
        <div className="staff-account">
          <div className="staff-account-avatar">
            {session.user.firstName.slice(0, 1)}
            {session.user.lastName.slice(0, 1)}
          </div>
          <div className="staff-account-name">
            <strong>
              {session.user.firstName} {session.user.lastName}
            </strong>
            <span>{session.user.roles.join(', ')}</span>
          </div>
          <button className="icon-button" onClick={() => void signOut()} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="staff-main">
        <header className="staff-header">
          <div>
            <span>OPERATIONS WORKSPACE</span>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <div className="header-right">
            <div className="connection-indicator">
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  marginRight: 6,
                  backgroundColor:
                    liveStatus === 'connected'
                      ? '#10b981'
                      : liveStatus === 'connecting'
                        ? '#f59e0b'
                        : '#64748b',
                  boxShadow:
                    liveStatus === 'connected'
                      ? '0 0 8px #10b981'
                      : 'none',
                }}
              />
              {liveStatus === 'connected'
                ? 'Live SSE Active'
                : liveStatus === 'connecting'
                  ? 'Connecting Live Stream…'
                  : 'API Connected'}
            </div>
            <button
              className="icon-button"
              onClick={() => void loadData()}
              disabled={busy}
              title="Refresh all data"
            >
              <RefreshCw size={16} className={busy ? 'spinning' : ''} />
            </button>
          </div>
        </header>

        <main className="staff-content">
          {liveAlert && (
            <div
              style={{
                background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
              }}
            >
              <div>
                <strong style={{ color: '#fca5a5', display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                  {liveAlert.title}
                </strong>
                <span style={{ color: '#f3f4f6', fontSize: '13px' }}>{liveAlert.message}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    background: '#ef4444',
                    borderColor: '#ef4444',
                    fontSize: '12px',
                    padding: '6px 12px',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setActiveTab('exceptions');
                    setLiveAlert(null);
                  }}
                >
                  Intercept in NDR
                </button>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                  }}
                  onClick={() => setLiveAlert(null)}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          {loadIssues.length > 0 && (
            <Alert variant="warning">
              <strong>Some data could not be loaded:</strong> {loadIssues.join(' · ')}
            </Alert>
          )}

          {activeTab === 'overview' && (
            <ControlTowerView
              summary={summary}
              exceptions={exceptions}
              busy={busy}
              loadIssues={loadIssues}
              userFirstName={session.user.firstName}
              userEmail={session.user.email}
              can={can}
              onRefresh={() => void loadData()}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              orderSearch={orderSearch}
              setOrderSearch={setOrderSearch}
              can={can}
              onVerify={verifyOrder}
              onCancel={cancelOrder}
              onPack={packOrder}
              onImportCsv={importOrders}
              onSendNotification={sendNotification}
            />
          )}

          {activeTab === 'warehouse' && (
            <WarehouseView
              stock={stock}
              products={products}
              locations={locations}
              inbound={inbound}
              transactions={transactions}
              merchants={merchants}
              busy={busy}
              can={can}
              onAdjustInventory={adjustInventory}
              onSubmitInbound={submitInbound}
              onReceiveInbound={receiveInbound}
            />
          )}

          {activeTab === 'picking' && (
            <PickingView
              waves={waves}
              orders={orders}
              selectedOrders={selectedOrders}
              setSelectedOrders={setSelectedOrders}
              busy={busy}
              can={can}
              onCreateWave={createWave}
              onStartWave={(waveId) =>
                perform(
                  () =>
                    api.request(`/fulfillment/waves/${encodeURIComponent(waveId)}/start`, {
                      method: 'POST',
                    }),
                  'Pick wave started.',
                ).then(() => {})
              }
              onCompleteWave={(waveId) =>
                perform(
                  () =>
                    api.request(`/fulfillment/waves/${encodeURIComponent(waveId)}/complete`, {
                      method: 'POST',
                    }),
                  'Pick wave completed.',
                ).then(() => {})
              }
              onMarkPicked={markPicked}
              onVerifyOrder={verifyOrder}
              onCancelOrder={cancelOrder}
              onPackOrder={packOrder}
            />
          )}

          {activeTab === 'dispatch' && (
            <DispatchView
              routes={routes}
              riders={riders}
              manifests={manifests}
              scanRouteId={scanRouteId}
              setScanRouteId={setScanRouteId}
              scanManifestId={scanManifestId}
              setScanManifestId={setScanManifestId}
              scanBarcode={scanBarcode}
              setScanBarcode={setScanBarcode}
              busy={busy}
              can={can}
              onCreateManifest={createManifest}
              onScanParcel={scanParcel}
              onHandover={handover}
            />
          )}

          {activeTab === 'exceptions' && (
            <ExceptionsView
              ndr={ndr}
              exceptions={exceptions}
              busy={busy}
              can={can}
              onResolveNdr={resolveNdr}
              onSendNotification={sendNotification}
            />
          )}

          {activeTab === 'returns' && (
            <ReturnsView
              orders={orders}
              returns={returns}
              locations={locations}
              selectedReturnOrderId={selectedReturnOrderId}
              setSelectedReturnOrderId={setSelectedReturnOrderId}
              selectedReturnProductId={selectedReturnProductId}
              setSelectedReturnProductId={setSelectedReturnProductId}
              busy={busy}
              can={can}
              onCreateReturn={createReturn}
              onReceiveReturn={receiveReturn}
              onInspectReturn={inspectReturn}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              shifts={shifts}
              settlements={settlements}
              ledgers={ledgers}
              merchants={merchants}
              riders={riders}
              busy={busy}
              can={can}
              api={api}
              onCloseShift={closeShift}
              onApproveShiftVariance={approveShiftVariance}
              onCreateSettlement={createSettlement}
              onApproveSettlement={(settlementId) =>
                perform(
                  () =>
                    api.request('/finance/settlements/approve', {
                      method: 'POST',
                      body: { settlementId },
                    }),
                  'Settlement approved.',
                ).then(() => {})
              }
              onDisburseMpesaB2C={(settlementId) =>
                perform(
                  () =>
                    api.request(
                      `/finance/settlements/${encodeURIComponent(settlementId)}/disburse`,
                      { method: 'POST' },
                    ),
                  'M-Pesa B2C disbursement requested.',
                ).then(() => {})
              }
              onMarkSettlementPaid={(settlementId, reference) =>
                perform(
                  () =>
                    api.request(
                      `/finance/settlements/${encodeURIComponent(settlementId)}/paid`,
                      { method: 'POST', body: { payoutReference: reference } },
                    ),
                  'Settlement marked paid.',
                ).then(() => {})
              }
            />
          )}

          {activeTab === 'setup' && (
            <SetupView
              merchants={merchants}
              products={products}
              can={can}
              onCreateMerchant={createMerchant}
              onCreateProduct={createProduct}
              onActivateMerchant={(merchantId) =>
                perform(
                  () =>
                    api.request(`/merchants/${encodeURIComponent(merchantId)}/activate`, {
                      method: 'POST',
                    }),
                  'Merchant activated.',
                ).then(() => {})
              }
              onAddMerchantUser={addMerchantUser}
              onCreateRider={createRider}
            />
          )}
        </main>
      </div>
    </div>
  );
}
