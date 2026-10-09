import React, { useCallback, useEffect, useState } from 'react';
import { api, type AuthSession } from '@shipit/api-client';
import type {
  InventoryStockSummary,
  MerchantLedgerEntry,
  MerchantSettlement,
  Order,
} from '@shipit/shared-types';
import {
  Banknote,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

import type { InboundShipment, MerchantData, Product, Tab, TrackingInfo, Warehouse } from './types';
import { emptyData } from './types';
import { Panel, Status } from './components/ui';

import { PublicTrackingPage } from './features/tracking/PublicTrackingPage';
import { OverviewView } from './features/overview/OverviewView';
import { OrdersView } from './features/orders/OrdersView';
import { InventoryView } from './features/inventory/InventoryView';
import { FinanceView } from './features/finance/FinanceView';

export default function App() {
  return window.location.pathname.replace(/\/+$/, '') === '/track' ? (
    <PublicTrackingPage />
  ) : (
    <MerchantPortal />
  );
}

function MerchantPortal() {
  const [session, setSession] = useState<AuthSession | null>(api.session);
  const [data, setData] = useState<MerchantData>(emptyData);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitPriceKes, setUnitPriceKes] = useState<number | ''>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const [orders, stock, products, warehouses, inbound, ledgers, settlements] = await Promise.all([
        api.request<Order[]>('/orders'),
        api.request<InventoryStockSummary[]>('/inventory/stock'),
        api.request<Product[]>('/products'),
        api.request<Warehouse[]>('/inbound/warehouses'),
        api.request<InboundShipment[]>('/inbound'),
        api.request<MerchantLedgerEntry[]>('/finance/ledgers'),
        api.request<MerchantSettlement[]>('/finance/settlements'),
      ]);
      setData({ orders, stock, products, warehouses, inbound, ledgers, settlements });
      setSelectedProductId((current) => current || products[0]?.id || '');
      setSelectedWarehouseId((current) => current || warehouses[0]?.id || '');
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not load merchant data.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void loadData();
  }, [session, loadData]);

  useEffect(() => {
    const selectedProduct = data.products.find((product) => product.id === selectedProductId);
    if (selectedProduct && unitPriceKes === '') setUnitPriceKes(selectedProduct.declaredValueKes);
  }, [data.products, selectedProductId, unitPriceKes]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await api.login(email, password);
      if (!result.user.merchantId) {
        await api.logout();
        throw new Error('This portal requires a merchant account.');
      }
      setSession(result);
      setPassword('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Sign-in failed.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    action: () => Promise<unknown>,
    success: string | ((result: unknown) => string),
  ) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      await loadData();
      setMessage(typeof success === 'function' ? success(result) : success);
      setMessageType('success');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The operation could not be completed.');
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.merchantId) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const productId = String(form.get('productId'));
    const product = data.products.find((item) => item.id === productId);
    if (!product) {
      setMessage('Choose an active product before creating an order.');
      setMessageType('error');
      return;
    }
    await runAction(async () => {
      await api.request<Order>('/orders', {
        method: 'POST',
        body: {
          merchantId: session.user.merchantId,
          customerName: String(form.get('customerName')),
          customerPhone: String(form.get('customerPhone')),
          address: {
            county: String(form.get('county')),
            townOrSubCounty: String(form.get('townOrSubCounty')),
            estateOrArea: String(form.get('estateOrArea')),
            buildingOrCourt: String(form.get('buildingOrCourt') || ''),
            landmark: String(form.get('landmark')),
            googleMapsUrl: String(form.get('googleMapsUrl') || ''),
          },
          items: [
            {
              productId,
              quantity: Number(form.get('quantity')),
              unitPriceKes: Number(form.get('unitPriceKes') || product.declaredValueKes),
            },
          ],
          deliveryFeeKes: Number(form.get('deliveryFeeKes') || 250),
          paymentMethod: String(form.get('paymentMethod')),
          codAmountExpectedKes: 0,
        },
      });
      formElement.reset();
    }, 'Order created. COD orders are now in the verification queue.');
  }

  async function createInbound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.merchantId) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const productId = String(form.get('productId'));
    const warehouseId = String(form.get('warehouseId'));
    if (!warehouseId || !productId) {
      setMessage('Select a storage location and product to schedule an inbound shipment.');
      setMessageType('error');
      return;
    }
    await runAction(async () => {
      await api.request('/inbound', {
        method: 'POST',
        body: {
          merchantId: session.user.merchantId,
          warehouseId,
          expectedDeliveryDate: String(form.get('expectedDeliveryDate')),
          notes: String(form.get('notes') || ''),
          items: [{ productId, expectedUnits: Number(form.get('expectedUnits')) }],
        },
      });
      formElement.reset();
    }, 'Inbound shipment advice created.');
  }

  async function importCsv(file?: File) {
    if (!file) return;
    await runAction(
      async () => {
        const result = await api.requestText<{ importedCount: number }>(
          '/orders/import',
          await file.text(),
        );
        return result.importedCount;
      },
      (result) => `Imported ${String(result)} orders successfully.`,
    );
  }

  async function createSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.merchantId) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      await api.request('/finance/settlements', {
        method: 'POST',
        body: {
          merchantId: session.user.merchantId,
          periodStart: String(form.get('periodStart')),
          periodEnd: String(form.get('periodEnd')),
        },
      });
      formElement.reset();
    }, 'Settlement request created from eligible reconciled ledger entries.');
  }

  async function trackOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTracking(null);
    setMessage('');
    try {
      const result = await api.publicRequest<TrackingInfo>(
        `/tracking/${encodeURIComponent(trackingNumber.trim())}`,
      );
      setTracking(result);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Tracking lookup failed.');
      setMessageType('error');
    }
  }

  async function downloadLabel(number: string) {
    try {
      const blob = await api.download(`/waybills/${encodeURIComponent(number)}/label.pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not download waybill.');
      setMessageType('error');
    }
  }

  async function signOut() {
    try {
      await api.logout();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not sign out cleanly.');
      setMessageType('error');
    } finally {
      setSession(null);
      setData(emptyData);
    }
  }

  if (!session) {
    return (
      <main className="merchant-auth">
        <form className="merchant-auth-card" onSubmit={handleLogin}>
          <div className="m-badge">S</div>
          <p className="eyebrow">SHIP IT · MERCHANT PORTAL</p>
          <h1>Sign in to your account</h1>
          <p>View fulfillment, inventory and COD settlement activity for your business.</p>
          {message && <div className="notice error">{message}</div>}
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="btn-emerald" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="merchant-app">
      <aside className="merchant-sidebar">
        <div className="merchant-logo">
          <div className="m-badge">
            {session.user.firstName.slice(0, 1)}
            {session.user.lastName.slice(0, 1)}
          </div>
          <div>
            <h3>
              {session.user.firstName} {session.user.lastName}
            </h3>
            <span>Merchant account</span>
          </div>
        </div>
        <nav className="m-links">
          {(
            [
              ['overview', 'Overview', <TrendingUp size={18} />],
              ['orders', 'Orders & waybills', <ShoppingBag size={18} />],
              ['inventory', 'Inventory & inbound', <Package size={18} />],
              ['finance', 'Ledger & settlements', <Banknote size={18} />],
              ['tracking', 'Public tracking', <Search size={18} />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              className={`m-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <span>{session.user.email}</span>
          <button className="m-btn" onClick={() => void signOut()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="m-main">
        <header className="m-header">
          <div>
            <h1>
              {activeTab === 'overview'
                ? 'Merchant overview'
                : activeTab === 'orders'
                ? 'Orders & waybills'
                : activeTab === 'inventory'
                ? 'Inventory & inbound shipments'
                : activeTab === 'finance'
                ? 'Ledger & settlements'
                : 'Shipment tracking'}
            </h1>
            <span>Ship It Fulfillment</span>
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => void loadData()}
              disabled={busy}
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
            <button className="btn-emerald" onClick={() => setActiveTab('orders')}>
              <Plus size={15} /> Create order
            </button>
          </div>
        </header>

        {message && (
          <div className={`notice ${messageType}`} role="status">
            {message}
            <button onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        <main className="m-content">
          {activeTab === 'overview' && (
            <OverviewView
              data={data}
              firstName={session.user.firstName}
              busy={busy}
              onNavigateToOrders={() => setActiveTab('orders')}
              onDownloadLabel={downloadLabel}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              data={data}
              products={data.products}
              selectedProductId={selectedProductId}
              setSelectedProductId={setSelectedProductId}
              unitPriceKes={unitPriceKes}
              setUnitPriceKes={setUnitPriceKes}
              searchText={searchText}
              setSearchText={setSearchText}
              busy={busy}
              onCreateOrder={createOrder}
              onImportCsv={importCsv}
              onDownloadLabel={downloadLabel}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              data={data}
              products={data.products}
              selectedWarehouseId={selectedWarehouseId}
              setSelectedWarehouseId={setSelectedWarehouseId}
              busy={busy}
              onCreateInbound={createInbound}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              data={data}
              busy={busy}
              onCreateSettlement={createSettlement}
            />
          )}

          {activeTab === 'tracking' && (
            <Panel title="Track a parcel" subtitle="Public tracking lookup; no sign-in required.">
              <form className="portal-form inline-form" onSubmit={(event) => void trackOrder(event)}>
                <label>
                  Waybill number
                  <input
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                    placeholder="WB-2026-…"
                    required
                  />
                </label>
                <button className="btn-emerald">
                  <Search size={15} /> Track
                </button>
              </form>
              {tracking && (
                <div className="tracking-result">
                  <div className="tracking-summary">
                    <div>
                      <span>Waybill</span>
                      <strong>{tracking.trackingNumber}</strong>
                    </div>
                    <div>
                      <span>Order status</span>
                      <Status value={tracking.status} />
                    </div>
                    <div>
                      <span>Destination</span>
                      <strong>
                        {tracking.destination.townOrSubCounty}, {tracking.destination.county}
                      </strong>
                    </div>
                  </div>
                  <ol className="timeline">
                    {tracking.timeline.map((event, index) => (
                      <li key={`${event.status}-${event.occurredAt}-${index}`}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{event.status.replaceAll('_', ' ')}</strong>
                          {event.detail && <p>{event.detail}</p>}
                          <time>{new Date(event.occurredAt).toLocaleString()}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
}
