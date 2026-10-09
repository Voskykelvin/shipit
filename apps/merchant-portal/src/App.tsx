import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AuthSession } from '@shipit/api-client';
import type { InventoryStockSummary, MerchantLedgerEntry, MerchantSettlement, Order } from '@shipit/shared-types';
import { Banknote, Box, FileUp, LogOut, Package, Plus, RefreshCw, Search, ShoppingBag, TrendingUp } from 'lucide-react';

type Tab = 'overview' | 'orders' | 'inventory' | 'finance' | 'tracking';

interface Product {
  id: string;
  sku: string;
  name: string;
  declaredValueKes: number;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface InboundShipment {
  id: string;
  asnNumber: string;
  status: string;
  expectedDeliveryDate: string;
  items: Array<{ id: string; productId: string; expectedUnits: number; receivedUnits: number }>;
}

interface TrackingInfo {
  trackingNumber: string;
  orderNumber: string;
  status: string;
  destination: { county: string; townOrSubCounty: string };
  timeline: Array<{ status: string; occurredAt: string; detail?: string }>;
}

interface MerchantData {
  orders: Order[];
  stock: InventoryStockSummary[];
  products: Product[];
  warehouses: Warehouse[];
  inbound: InboundShipment[];
  ledgers: MerchantLedgerEntry[];
  settlements: MerchantSettlement[];
}

const emptyData: MerchantData = {
  orders: [], stock: [], products: [], warehouses: [], inbound: [], ledgers: [], settlements: [],
};

const kes = (amount: number) => `KES ${amount.toLocaleString()}`;
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function App() {
  return window.location.pathname.replace(/\/+$/, '') === '/track'
    ? <PublicTrackingPage />
    : <MerchantPortal />;
}

function PublicTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState(() =>
    new URLSearchParams(window.location.search).get('waybill')?.trim() ?? '',
  );
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latestLookup = useRef(0);

  const lookup = useCallback(async (number: string) => {
    const lookupId = ++latestLookup.current;
    setBusy(true);
    setError('');
    setTracking(null);
    try {
      const result = await api.publicRequest<TrackingInfo>(`/tracking/${encodeURIComponent(number)}`);
      if (lookupId === latestLookup.current) setTracking(result);
    } catch (cause) {
      if (lookupId === latestLookup.current) {
        setError(cause instanceof Error ? cause.message : 'Tracking lookup failed.');
      }
    } finally {
      if (lookupId === latestLookup.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initialWaybill = new URLSearchParams(window.location.search).get('waybill')?.trim();
    if (initialWaybill) void lookup(initialWaybill);
  }, [lookup]);

  return (
    <main className="public-tracking">
      <header className="public-tracking-brand">
        <a className="tracking-brand-mark" href="/" aria-label="Ship It merchant portal">S</a>
        <div><strong>Ship It</strong><span>Parcel tracking</span></div>
        <a className="tracking-merchant-link" href="/">Merchant sign in</a>
      </header>
      <section className="public-tracking-content">
        <div className="tracking-intro">
          <span className="tracking-eyebrow">SHIP IT DELIVERY</span>
          <h1>Your parcel, in view.</h1>
          <p>Enter the waybill number to see the latest delivery progress.</p>
        </div>
        <form className="tracking-search-card" onSubmit={(event) => {
          event.preventDefault();
          const number = trackingNumber.trim();
          if (number) void lookup(number);
        }}>
          <label htmlFor="public-waybill">Waybill number</label>
          <div className="tracking-search-row">
            <input
              id="public-waybill"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="WB-2026-…"
              autoComplete="off"
              required
            />
            <button type="submit" disabled={busy || !trackingNumber.trim()}>
              <Search size={16} /> {busy ? 'Checking…' : 'Track parcel'}
            </button>
          </div>
          {error && <p className="tracking-error" role="alert">{error}</p>}
        </form>
        {tracking && (
          <section className="tracking-result public-tracking-result" aria-live="polite">
            <div className="tracking-result-heading">
              <div className="tracking-parcel-icon"><Package size={21} /></div>
              <div><span>WAYBILL</span><strong>{tracking.trackingNumber}</strong></div>
              <Status value={tracking.status} />
            </div>
            <div className="public-destination">
              <span>Delivering to</span>
              <strong>{tracking.destination.townOrSubCounty}, {tracking.destination.county}</strong>
            </div>
            <ol className="timeline">
              {tracking.timeline.map((item, index) => (
                <li key={`${item.status}-${item.occurredAt}-${index}`}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.status.replaceAll('_', ' ')}</strong>
                    {item.detail && <p>{item.detail}</p>}
                    <time>{new Date(item.occurredAt).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
            <p className="tracking-privacy">Tracking shows delivery milestones and destination area only. For help, contact your seller.</p>
          </section>
        )}
      </section>
    </main>
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

  async function runAction(action: () => Promise<unknown>, success: string | ((result: unknown) => string)) {
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
          items: [{
            productId,
            quantity: Number(form.get('quantity')),
            unitPriceKes: Number(form.get('unitPriceKes') || product.declaredValueKes),
          }],
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
    await runAction(async () => {
      const result = await api.requestText<{ importedCount: number }>('/orders/import', await file.text());
      return result.importedCount;
    }, (result) => `Imported ${String(result)} orders successfully.`);
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
      const result = await api.publicRequest<TrackingInfo>(`/tracking/${encodeURIComponent(trackingNumber.trim())}`);
      setTracking(result);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Tracking lookup failed.');
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
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="btn-emerald" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    );
  }

  const filteredOrders = data.orders.filter((order) =>
    `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.waybillNumber ?? ''}`
      .toLowerCase().includes(searchText.toLowerCase()),
  );
  const stockUnits = data.stock.reduce((sum, item) => sum + item.availableQty, 0);
  const openOrders = data.orders.filter((order) => !['DELIVERED', 'CANCELLED', 'RETURNED_TO_WAREHOUSE'].includes(order.status)).length;
  const balance = data.ledgers.reduce((sum, entry) => sum + entry.amountKes, 0);
  const products = data.products;

  return (
    <div className="merchant-app">
      <aside className="merchant-sidebar">
        <div className="merchant-logo"><div className="m-badge">{session.user.firstName.slice(0, 1)}{session.user.lastName.slice(0, 1)}</div><div><h3>{session.user.firstName} {session.user.lastName}</h3><span>Merchant account</span></div></div>
        <nav className="m-links">
          {([
            ['overview', 'Overview', <TrendingUp size={18} />],
            ['orders', 'Orders & waybills', <ShoppingBag size={18} />],
            ['inventory', 'Inventory & inbound', <Package size={18} />],
            ['finance', 'Ledger & settlements', <Banknote size={18} />],
            ['tracking', 'Public tracking', <Search size={18} />],
          ] as const).map(([key, label, icon]) => (
            <button key={key} className={`m-btn ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>{icon}{label}</button>
          ))}
        </nav>
        <div className="sidebar-account"><span>{session.user.email}</span><button className="m-btn" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button></div>
      </aside>

      <div className="m-main">
        <header className="m-header">
          <div><h1>{activeTab === 'overview' ? 'Merchant overview' : activeTab === 'orders' ? 'Orders & waybills' : activeTab === 'inventory' ? 'Inventory & inbound shipments' : activeTab === 'finance' ? 'Ledger & settlements' : 'Shipment tracking'}</h1><span>Ship It Fulfillment</span></div>
          <div className="header-actions"><button className="icon-button" onClick={() => void loadData()} disabled={busy} title="Refresh data"><RefreshCw size={16} /></button><button className="btn-emerald" onClick={() => setActiveTab('orders')}><Plus size={15} /> Create order</button></div>
        </header>
        {message && <div className={`notice ${messageType}`} role="status">{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
        <main className="m-content">
          {activeTab === 'overview' && (
            <>
              <div className="welcome-row"><div><p className="eyebrow">YOUR FULFILLMENT SNAPSHOT</p><h2>Welcome, {session.user.firstName}</h2><p>Live figures from your orders, inventory and merchant ledger.</p></div><span className="live-chip">{busy ? 'SYNCING' : 'LIVE DATA'}</span></div>
              <div className="grid-4">
                <Metric icon={<Box />} label="Available stock" value={`${stockUnits.toLocaleString()} units`} detail={`${data.stock.length} product SKUs`} />
                <Metric icon={<ShoppingBag />} label="Open orders" value={openOrders.toLocaleString()} detail={`${data.orders.length} total orders`} />
                <Metric icon={<Banknote />} label="Ledger balance" value={kes(balance)} detail="Net posted transactions" />
                <Metric icon={<Package />} label="Inbound shipments" value={data.inbound.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)).length.toString()} detail={`${data.inbound.length} total ASNs`} />
              </div>
              <Panel title="Latest orders" action={<button className="text-button" onClick={() => setActiveTab('orders')}>View all</button>}>
                <OrderTable orders={data.orders.slice(0, 6)} onLabel={async (number) => {
                  try {
                    const blob = await api.download(`/waybills/${encodeURIComponent(number)}/label.pdf`);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${number}.pdf`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not download waybill.'); setMessageType('error'); }
                }} />
              </Panel>
            </>
          )}

          {activeTab === 'orders' && (
            <>
              <div className="split-grid">
                <Panel title="Create a delivery order" subtitle="COD orders are held for verification before inventory is reserved.">
                  {products.length === 0 ? <EmptyState>No active products are available to order. Ask your account manager to add products.</EmptyState> : (
                    <form className="portal-form" onSubmit={(event) => void createOrder(event)}>
                      <div className="form-grid">
                        <label>Customer name<input name="customerName" required minLength={2} /></label>
                        <label>Phone number<input name="customerPhone" type="tel" placeholder="0712345678" required /></label>
                        <label>County<input name="county" defaultValue="Nairobi" required /></label>
                        <label>Town / sub-county<input name="townOrSubCounty" required /></label>
                        <label>Estate / area<input name="estateOrArea" required /></label>
                        <label>Building / court<input name="buildingOrCourt" /></label>
                        <label className="field-wide">Delivery landmark<input name="landmark" required minLength={3} placeholder="Specific directions the rider can follow" /></label>
                        <label className="field-wide">Google Maps URL<input name="googleMapsUrl" type="url" /></label>
                        <label>Product<select name="productId" value={selectedProductId} onChange={(event) => {
                          const productId = event.target.value;
                          setSelectedProductId(productId);
                          setUnitPriceKes(data.products.find((product) => product.id === productId)?.declaredValueKes ?? '');
                        }} required>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
                        <label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
                        <label>Unit price (KES)<input name="unitPriceKes" type="number" min="0" value={unitPriceKes} onChange={(event) => setUnitPriceKes(event.target.value === '' ? '' : Number(event.target.value))} required /></label>
                        <label>Delivery fee (KES)<input name="deliveryFeeKes" type="number" min="0" defaultValue="250" required /></label>
                        <label>Payment method<select name="paymentMethod"><option value="COD_MPESA">Cash on delivery · M-Pesa</option><option value="COD_CASH">Cash on delivery · cash</option><option value="PREPAID">Prepaid</option></select></label>
                      </div>
                      <button className="btn-emerald" disabled={busy}><Plus size={15} /> Submit order</button>
                    </form>
                  )}
                </Panel>
                <Panel title="Bulk import orders" subtitle="Upload the CSV template accepted by the Ship It API.">
                  <p className="helper-copy">Each order row needs merchant_id, address fields, product_sku, quantity, unit_price_kes and payment_method. Group multiple product rows with the same external_reference.</p>
                  <label className="upload-button"><FileUp size={18} /> Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event.target.files?.[0])} /></label>
                </Panel>
              </div>
              <Panel title="Your orders" action={<div className="search-field"><Search size={15} /><input aria-label="Search orders" placeholder="Order, customer or waybill" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></div>}>
                <OrderTable orders={filteredOrders} onLabel={async (number) => {
                  try {
                    const blob = await api.download(`/waybills/${encodeURIComponent(number)}/label.pdf`);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${number}.pdf`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not download waybill.'); setMessageType('error'); }
                }} />
              </Panel>
            </>
          )}

          {activeTab === 'inventory' && (
            <>
              <div className="split-grid">
                <Panel title="Schedule inbound stock" subtitle="Create an ASN for stock expected at the warehouse.">
                  {products.length === 0 ? <EmptyState>Add a product before creating an inbound shipment.</EmptyState> : (
                    <form className="portal-form" onSubmit={(event) => void createInbound(event)}>
                      <label>Product<select name="productId" required>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
                      <label>Expected units<input name="expectedUnits" type="number" min="1" required /></label>
                      <label>Expected delivery date<input name="expectedDeliveryDate" type="date" min={dateToday()} required /></label>
                      <label>Notes<input name="notes" /></label>
                      <label>Warehouse<select name="warehouseId" value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)} required>{data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</option>)}</select></label>
                      <button className="btn-emerald" disabled={busy}>Create ASN</button>
                    </form>
                  )}
                </Panel>
                <Panel title="Scheduled ASNs" subtitle="Warehouse staff will confirm received quantities and any damage.">
                  {data.inbound.length === 0 ? <EmptyState>No inbound shipments have been scheduled.</EmptyState> : data.inbound.map((asn) => (
                    <div className="asn-row" key={asn.id}><div><strong>{asn.asnNumber}</strong><span>{new Date(asn.expectedDeliveryDate).toLocaleDateString()} · {asn.items.length} items</span></div><Status value={asn.status} /></div>
                  ))}
                </Panel>
              </div>
              <Panel title="Current stock" subtitle="Stock quantities are read from the inventory ledger.">
                <div className="table-scroll"><table className="m-table"><thead><tr><th>SKU</th><th>Product</th><th>Available</th><th>Reserved</th><th>Damaged</th><th>Quarantine</th><th>Total physical</th></tr></thead><tbody>{data.stock.map((item) => <tr key={item.productId}><td><code className="code-pill">{item.sku}</code></td><td>{item.productName}</td><td>{item.availableQty}</td><td>{item.reservedQty}</td><td>{item.damagedQty}</td><td>{item.quarantineQty}</td><td>{item.totalPhysicalQty}</td></tr>)}</tbody></table></div>
              </Panel>
            </>
          )}

          {activeTab === 'finance' && (
            <>
              <Panel title="Request a merchant settlement" subtitle="A settlement includes eligible reconciled ledger entries within this date range.">
                <form className="portal-form inline-form" onSubmit={(event) => void createSettlement(event)}>
                  <label>Period start<input name="periodStart" type="date" required /></label><label>Period end<input name="periodEnd" type="date" required /></label><button className="btn-emerald" disabled={busy}>Request settlement</button>
                </form>
              </Panel>
              <Panel title="Settlement history">
                <div className="table-scroll"><table className="m-table"><thead><tr><th>Settlement</th><th>Created</th><th>Gross COD</th><th>Fees</th><th>Net payout</th><th>Status</th><th>Reference</th></tr></thead><tbody>{data.settlements.map((settlement) => <tr key={settlement.id}><td><code className="code-pill">{settlement.settlementNumber}</code></td><td>{new Date(settlement.createdAt).toLocaleDateString()}</td><td>{kes(settlement.grossCodCollectedKes)}</td><td>{kes(settlement.totalFeesDeductedKes)}</td><td><strong>{kes(settlement.netPayoutKes)}</strong></td><td><Status value={settlement.status} /></td><td>{settlement.payoutReference ?? '—'}</td></tr>)}</tbody></table></div>
              </Panel>
              <Panel title="Merchant ledger" subtitle="Append-only transactions for COD credits, fees, returns and settlement payouts.">
                <div className="table-scroll"><table className="m-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Order</th><th>Amount</th><th>Balance</th></tr></thead><tbody>{data.ledgers.map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.type}</td><td>{entry.description}</td><td>{entry.orderId ?? '—'}</td><td className={entry.amountKes >= 0 ? 'amount-positive' : 'amount-negative'}>{kes(entry.amountKes)}</td><td>{kes(entry.runningBalanceKes)}</td></tr>)}</tbody></table></div>
              </Panel>
            </>
          )}

          {activeTab === 'tracking' && (
            <Panel title="Track a parcel" subtitle="Public tracking lookup; no sign-in required.">
              <form className="portal-form inline-form" onSubmit={(event) => void trackOrder(event)}>
                <label>Waybill number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="WB-2026-…" required /></label><button className="btn-emerald"><Search size={15} /> Track</button>
              </form>
              {tracking && <div className="tracking-result"><div className="tracking-summary"><div><span>Waybill</span><strong>{tracking.trackingNumber}</strong></div><div><span>Order status</span><Status value={tracking.status} /></div><div><span>Destination</span><strong>{tracking.destination.townOrSubCounty}, {tracking.destination.county}</strong></div></div><ol className="timeline">{tracking.timeline.map((event, index) => <li key={`${event.status}-${event.occurredAt}-${index}`}><span className="timeline-dot" /><div><strong>{event.status.replaceAll('_', ' ')}</strong>{event.detail && <p>{event.detail}</p>}<time>{new Date(event.occurredAt).toLocaleString()}</time></div></li>)}</ol></div>}
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <section className="card metric-card"><div className="metric-icon">{icon}</div><span className="metric-title">{label}</span><strong className="metric-val">{value}</strong><span className="metric-detail">{detail}</span></section>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="portal-panel"><header className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function Status({ value }: { value: string }) {
  return <span className={`status-badge status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>;
}

function OrderTable({ orders, onLabel }: { orders: Order[]; onLabel: (trackingNumber: string) => void }) {
  return (
    <div className="table-scroll"><table className="m-table"><thead><tr><th>Order / Waybill</th><th>Customer</th><th>Destination</th><th>Items</th><th>COD</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>
      {orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong>{order.waybillNumber && <small className="table-subline">{order.waybillNumber}</small>}</td><td>{order.customerName}<small className="table-subline">{order.customerPhone}</small></td><td>{order.address.townOrSubCounty}, {order.address.county}</td><td>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</td><td>{kes(order.codAmountExpectedKes)}</td><td><Status value={order.status} /></td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{order.waybillNumber && <><a className="text-button tracking-link" href={`/track?waybill=${encodeURIComponent(order.waybillNumber)}`} target="_blank" rel="noreferrer">Track</a><button className="text-button" onClick={() => onLabel(order.waybillNumber!)}>Label PDF</button></>}</td></tr>)}
      {orders.length === 0 && <tr><td colSpan={8}><EmptyState>No orders found.</EmptyState></td></tr>}
    </tbody></table></div>
  );
}
