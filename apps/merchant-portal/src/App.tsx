import React, { useState } from 'react';
import {
  Package,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Plus,
  Truck,
  CheckCircle,
  FileText,
  AlertCircle,
  Building,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'orders' | 'finances'>('overview');
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [county, setCounty] = useState('Nairobi');
  const [town, setTown] = useState('Westlands');
  const [estate, setEstate] = useState('');
  const [landmark, setLandmark] = useState('');
  const [productSelection, setProductSelection] = useState('prod-001');
  const [quantity, setQuantity] = useState(1);

  // Orders State
  const [orders, setOrders] = useState([
    {
      id: 'ord-1001',
      orderNumber: 'ORD-90412',
      customerName: 'Jane Wambui',
      phone: '+254 712 345 678',
      area: 'Westlands, Rhapta Road',
      items: '1x Glow Radiance Serum, 1x Hydrating Cream',
      cod: 'KES 5,250',
      status: 'Ready for Pick',
      tracking: 'WB-90412-KE',
    },
    {
      id: 'ord-1002',
      orderNumber: 'ORD-90413',
      customerName: 'Brian Kiprop',
      phone: '+254 714 889 900',
      area: 'Kilimani, Dennis Pritt Rd',
      items: '1x Glow Radiance Serum 50ml',
      cod: 'KES 3,050',
      status: 'Verifying Phone',
      tracking: 'Pending',
    },
    {
      id: 'ord-1005',
      orderNumber: 'ORD-90410',
      customerName: 'Diana Chebet',
      phone: '+254 722 880 011',
      area: 'Kilimani, Argwings Kodhek',
      items: '2x Hydrating Day Cream SPF 30',
      cod: 'KES 4,650',
      status: 'Customer Unreachable (NDR)',
      tracking: 'WB-90410-KE',
    },
  ]);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !landmark) {
      alert('Please fill out customer name, phone, and delivery landmark.');
      return;
    }

    const newOrd = {
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      customerName,
      phone: customerPhone,
      area: `${town}, ${estate}`,
      items: `${quantity}x Glow Radiance Vitamin C Serum`,
      cod: `KES ${(quantity * 2800 + 250).toLocaleString()}`,
      status: 'Ready for Pick',
      tracking: `WB-${Math.floor(10000 + Math.random() * 90000)}-KE`,
    };

    setOrders([newOrd, ...orders]);
    setShowOrderModal(false);
    setCustomerName('');
    setCustomerPhone('');
    setEstate('');
    setLandmark('');
    alert(`Order ${newOrd.orderNumber} placed and synced to Ship It Fulfillment Warehouse!`);
  };

  return (
    <div className="merchant-app">
      {/* Sidebar */}
      <aside className="merchant-sidebar">
        <div className="merchant-logo">
          <div className="m-badge">BG</div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>BeautyGlow</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>Merchant ID: #m-001</span>
          </div>
        </div>

        <ul className="m-links">
          <li>
            <button
              className={`m-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <TrendingUp size={18} />
              Overview
            </button>
          </li>
          <li>
            <button
              className={`m-btn ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package size={18} />
              Inventory & ASN
            </button>
          </li>
          <li>
            <button
              className={`m-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <ShoppingBag size={18} />
              Orders & Waybills
            </button>
          </li>
          <li>
            <button
              className={`m-btn ${activeTab === 'finances' ? 'active' : ''}`}
              onClick={() => setActiveTab('finances')}
            >
              <DollarSign size={18} />
              COD & Settlements
            </button>
          </li>
        </ul>

        <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Warehouse Hub:</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>Nairobi Industrial Area</div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="m-main">
        <header className="m-header">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Merchant Self-Service Control Center</h2>
          </div>
          <div>
            <button className="btn-emerald" onClick={() => setShowOrderModal(true)}>
              <Plus size={16} style={{ display: 'inline', marginRight: 4 }} />
              + Create New Order
            </button>
          </div>
        </header>

        <main className="m-content">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div className="grid-4">
                <div className="card">
                  <span className="metric-title">Available Stock</span>
                  <div className="metric-val" style={{ color: '#34d399' }}>237 Units</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Stored in Ship It WH-01</span>
                </div>
                <div className="card">
                  <span className="metric-title">Active Orders Today</span>
                  <div className="metric-val">34 Orders</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>12 in picking, 22 in transit</span>
                </div>
                <div className="card">
                  <span className="metric-title">Pending COD Balance</span>
                  <div className="metric-val">KES 184,500</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Clearing into merchant ledger</span>
                </div>
                <div className="card">
                  <span className="metric-title">Next Scheduled Payout</span>
                  <div className="metric-val" style={{ color: '#60a5fa' }}>Friday (Oct 10)</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Disbursement via M-Pesa B2C</span>
                </div>
              </div>

              {/* Recent Orders table */}
              <div className="m-table-card">
                <div className="m-table-header">
                  <span style={{ fontWeight: 700 }}>Live Dispatch & Fulfillment Feed</span>
                  <span className="code-pill">SYNCED</span>
                </div>
                <table className="m-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Destination</th>
                      <th>Items</th>
                      <th>COD Expected</th>
                      <th>Status</th>
                      <th>Waybill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><span className="code-pill">{o.orderNumber}</span></td>
                        <td><strong>{o.customerName}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{o.phone}</small></td>
                        <td>{o.area}</td>
                        <td>{o.items}</td>
                        <td><strong>{o.cod}</strong></td>
                        <td>
                          {o.status.includes('Ready') && <span style={{ color: '#34d399' }}>✓ {o.status}</span>}
                          {o.status.includes('Verifying') && <span style={{ color: '#f59e0b' }}>⏳ {o.status}</span>}
                          {o.status.includes('Unreachable') && <span style={{ color: '#ef4444' }}>⚠ {o.status}</span>}
                        </td>
                        <td><span className="code-pill">{o.tracking}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="m-table-card">
              <div className="m-table-header">
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Real-Time Physical Stock Breakdown</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Audited inventory ledger from Ship It Warehouse Bins.
                  </p>
                </div>
                <button className="btn-emerald" onClick={() => alert('ASN Inbound form opened!')}>
                  + Schedule Stock Inbound (ASN)
                </button>
              </div>
              <table className="m-table">
                <thead>
                  <tr>
                    <th>SKU Code</th>
                    <th>Product Name</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Damaged</th>
                    <th>Total In Warehouse</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="code-pill">BG-SERUM-50ML</span></td>
                    <td><strong>Glow Radiance Vitamin C Serum 50ml</strong></td>
                    <td><span style={{ color: '#34d399', fontWeight: 700 }}>142</span></td>
                    <td>18</td>
                    <td>3</td>
                    <td>163</td>
                    <td><span style={{ color: '#34d399' }}>In Stock</span></td>
                  </tr>
                  <tr>
                    <td><span className="code-pill">BG-CREAM-100ML</span></td>
                    <td><strong>Hydrating Day Cream SPF 30 100ml</strong></td>
                    <td><span style={{ color: '#34d399', fontWeight: 700 }}>95</span></td>
                    <td>12</td>
                    <td>1</td>
                    <td>108</td>
                    <td><span style={{ color: '#34d399' }}>In Stock</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="m-table-card">
              <div className="m-table-header">
                <span style={{ fontWeight: 700 }}>All Merchant Orders</span>
                <button className="btn-emerald" onClick={() => setShowOrderModal(true)}>
                  + New Order
                </button>
              </div>
              <table className="m-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Area</th>
                    <th>Items</th>
                    <th>COD Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><span className="code-pill">{o.orderNumber}</span></td>
                      <td>{o.customerName}</td>
                      <td>{o.phone}</td>
                      <td>{o.area}</td>
                      <td>{o.items}</td>
                      <td><strong>{o.cod}</strong></td>
                      <td>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: FINANCES */}
          {activeTab === 'finances' && (
            <div className="m-table-card">
              <div className="m-table-header">
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Financial Ledger & Settlement History</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    COD collected minus transparent fulfillment and delivery rate card deductions.
                  </p>
                </div>
                <button className="btn-emerald" onClick={() => alert('Payout request sent to Ship It finance!')}>
                  Request Immediate Payout
                </button>
              </div>
              <table className="m-table">
                <thead>
                  <tr>
                    <th>Settlement #</th>
                    <th>Gross COD Collected</th>
                    <th>Fulfillment & Delivery Fees</th>
                    <th>Net Payout Disbursed</th>
                    <th>Payment Channel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="code-pill">SET-2026-0089</span></td>
                    <td>KES 210,000</td>
                    <td>-KES 18,500</td>
                    <td><strong style={{ color: '#34d399' }}>KES 191,500</strong></td>
                    <td>M-Pesa B2C (KB89102X)</td>
                    <td><span style={{ color: '#34d399' }}>✓ Paid</span></td>
                  </tr>
                  <tr>
                    <td><span className="code-pill">SET-2026-0094</span></td>
                    <td>KES 184,500</td>
                    <td>-KES 16,200</td>
                    <td><strong style={{ color: '#60a5fa' }}>KES 168,300</strong></td>
                    <td>Pending Friday Cycle</td>
                    <td><span style={{ color: '#f59e0b' }}>Processing</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* CREATE ORDER MODAL */}
      {showOrderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '540px',
              maxWidth: '90vw',
              padding: '1.75rem',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>
              Create Customer Order
            </h3>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Full Name</label>
                <input
                  type="text"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                  }}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Grace Mwende"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Phone (M-Pesa)</label>
                  <input
                    type="text"
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                    }}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="07XXXXXXXX"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Town / Sub-County</label>
                  <select
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                    }}
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                  >
                    <option value="Westlands">Westlands</option>
                    <option value="Kilimani">Kilimani</option>
                    <option value="Roysambu">Roysambu</option>
                    <option value="South B">South B</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estate / Building</label>
                <input
                  type="text"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                  }}
                  value={estate}
                  onChange={(e) => setEstate(e.target.value)}
                  placeholder="e.g. Rhapta Heights, 3rd Floor Apt 4"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Landmark (Critical for Rider)</label>
                <input
                  type="text"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                  }}
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Shell petrol station, pink gate"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Product</label>
                  <select
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                    }}
                    value={productSelection}
                    onChange={(e) => setProductSelection(e.target.value)}
                  >
                    <option value="prod-001">Glow Radiance Serum 50ml (KES 2,800)</option>
                    <option value="prod-002">Hydrating Day Cream SPF 30 (KES 2,200)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                    }}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowOrderModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-emerald">
                  Submit & Sync Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
