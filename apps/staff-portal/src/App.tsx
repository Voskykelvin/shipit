import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Barcode,
  Package,
  PhoneCall,
  Truck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  Box,
  Layers,
  UserCheck,
  Building2,
  Check,
} from 'lucide-react';
import {
  Order,
  InventoryStockSummary,
  WarehouseLocation,
  InboundShipmentASN,
  DispatchManifest,
  NDRCase,
  RiderShiftReconciliation,
  SystemException,
} from '@shipit/shared-types';

type ActiveTab =
  | 'control-tower'
  | 'scan-station'
  | 'customer-care'
  | 'wms-inventory'
  | 'dispatch'
  | 'ndr'
  | 'finance';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('control-tower');
  const [loading, setLoading] = useState(false);

  // Core Data States
  const [kpis, setKpis] = useState({
    totalOrdersToday: 1420,
    pendingVerification: 18,
    readyToPick: 42,
    packed: 67,
    outForDelivery: 83,
    delivered: 782,
    ndrExceptions: 12,
    totalCodCollectedKes: 1845000,
    totalCodPendingKes: 420000,
    deliverySuccessRatePct: 87.6,
    rtoRatePct: 4.8,
  });

  const [exceptions, setExceptions] = useState<SystemException[]>([
    {
      id: 'exc-001',
      category: 'COD_VARIANCE',
      severity: 'HIGH',
      title: 'Rider Shift Shortage: Peter Karanja',
      details: 'Shift #shift-001 has KES -1,000 cash shortage against expected physical notes.',
      entityId: 'shift-001',
      entityType: 'RIDER_SHIFT',
      isResolved: false,
      createdAt: '17:30 EAT',
    },
    {
      id: 'exc-002',
      category: 'FAILED_DELIVERY',
      severity: 'HIGH',
      title: 'NDR Alert: Order ORD-90410 Unreachable',
      details: 'Rider John Mwangi at Kilimani reports customer phone is ringing with no answer.',
      entityId: 'ord-1005',
      entityType: 'ORDER',
      isResolved: false,
      createdAt: '14:45 EAT',
    },
    {
      id: 'exc-003',
      category: 'STOCK_SHORTAGE',
      severity: 'MEDIUM',
      title: 'SKU Reorder Alert: ST-PBANK-20K',
      details: 'Available stock is 48 units, approaching safety threshold of 10 units.',
      entityId: 'prod-003',
      entityType: 'INVENTORY',
      isResolved: false,
      createdAt: '10:15 EAT',
    },
  ]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [stockList, setStockList] = useState<InventoryStockSummary[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [asns, setAsns] = useState<InboundShipmentASN[]>([]);
  const [manifests, setManifests] = useState<DispatchManifest[]>([]);
  const [ndrList, setNdrList] = useState<NDRCase[]>([]);
  const [shifts, setShifts] = useState<RiderShiftReconciliation[]>([]);

  // Scan Station State
  const [scanBarcode, setScanBarcode] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('WESTLANDS-01');
  const [scanFeedback, setScanFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    order?: Order;
    correctRoute?: string;
  }>({ status: 'idle', message: '' });

  // Web Audio feedback generator
  const playAudioBeep = (isSuccess: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isSuccess) {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // AudioContext not allowed before user interaction
    }
  };

  // Fetch initial data from local API if available
  const loadData = async () => {
    setLoading(true);
    try {
      const [resSummary, resOrders, resStock, resAsn, resNdr, resShifts] = await Promise.all([
        fetch('/api/control-tower/summary').then((r) => r.json()).catch(() => null),
        fetch('/api/orders').then((r) => r.json()).catch(() => null),
        fetch('/api/inventory/stock').then((r) => r.json()).catch(() => null),
        fetch('/api/inbound').then((r) => r.json()).catch(() => null),
        fetch('/api/ndr').then((r) => r.json()).catch(() => null),
        fetch('/api/finance/rider-shifts').then((r) => r.json()).catch(() => null),
      ]);

      if (resSummary?.kpis) setKpis(resSummary.kpis);
      if (resSummary?.activeExceptions) setExceptions(resSummary.activeExceptions);
      if (Array.isArray(resOrders)) setOrders(resOrders);
      if (Array.isArray(resStock)) setStockList(resStock);
      if (Array.isArray(resAsn)) setAsns(resAsn);
      if (Array.isArray(resNdr)) setNdrList(resNdr);
      if (Array.isArray(resShifts)) setShifts(resShifts);
    } catch {
      console.log('API not connected yet, operating in local demonstration mode');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler: Scan Barcode
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBarcode.trim()) return;

    try {
      const res = await fetch('/api/dispatch/scan-waybill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: scanBarcode.trim(),
          targetRouteCode: selectedRoute,
        }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        playAudioBeep(true);
        setScanFeedback({
          status: 'success',
          message: `✓ VALID PARCEL: Added to ${selectedRoute} Manifest`,
          order: data.order,
          correctRoute: data.correctRouteCode,
        });
      } else {
        playAudioBeep(false);
        setScanFeedback({
          status: 'error',
          message: data.message || `⚠ ROUTE MISMATCH! Belongs to ${data.correctRouteCode || 'ANOTHER ROUTE'}`,
          order: data.order,
          correctRoute: data.correctRouteCode,
        });
      }
    } catch {
      // Local fallback simulation
      const code = scanBarcode.trim().toUpperCase();
      if (code.includes('90412') || code.includes('WESTLANDS')) {
        playAudioBeep(true);
        setScanFeedback({
          status: 'success',
          message: `✓ VALID PARCEL: WB-${code} verified for ${selectedRoute}`,
        });
      } else {
        playAudioBeep(false);
        setScanFeedback({
          status: 'error',
          message: `⚠ ROUTE MISMATCH: Parcel belongs to KILIMANI-02, but current manifest is ${selectedRoute}`,
          correctRoute: 'KILIMANI-02',
        });
      }
    }

    setScanBarcode('');
  };

  // Handler: Verify order
  const handleVerifyOrder = async (orderId: string, isConfirmed: boolean) => {
    try {
      await fetch(`/api/orders/${orderId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConfirmed, notes: isConfirmed ? 'Confirmed via phone' : 'Customer cancelled' }),
      });
      loadData();
    } catch {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: isConfirmed ? 'READY_FOR_PICK' : 'CANCELLED' }
            : o
        )
      );
    }
  };

  // Handler: Resolve NDR
  const handleResolveNdr = async (ndrId: string, resolution: 'RETRY' | 'RTO') => {
    try {
      await fetch(`/api/ndr/${ndrId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, notes: 'Contacted customer via WhatsApp' }),
      });
      loadData();
    } catch {
      setNdrList((prev) => prev.filter((n) => n.id !== ndrId));
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">S</div>
          <div className="logo-text">
            <h1>Ship It</h1>
            <span>Fulfillment OS</span>
          </div>
        </div>

        <ul className="nav-links">
          <li>
            <button
              className={`nav-button ${activeTab === 'control-tower' ? 'active' : ''}`}
              onClick={() => setActiveTab('control-tower')}
            >
              <TrendingUp size={18} />
              Control Tower
              {exceptions.filter((e) => !e.isResolved).length > 0 && (
                <span className="nav-badge badge-danger">
                  {exceptions.filter((e) => !e.isResolved).length}
                </span>
              )}
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'scan-station' ? 'active' : ''}`}
              onClick={() => setActiveTab('scan-station')}
            >
              <Barcode size={18} />
              Waybill Scan Station
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'customer-care' ? 'active' : ''}`}
              onClick={() => setActiveTab('customer-care')}
            >
              <PhoneCall size={18} />
              Order Verification
              <span className="nav-badge badge-warning">
                {orders.filter((o) => o.status === 'PENDING_VERIFICATION').length || 2}
              </span>
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'wms-inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('wms-inventory')}
            >
              <Package size={18} />
              WMS & Inventory
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'dispatch' ? 'active' : ''}`}
              onClick={() => setActiveTab('dispatch')}
            >
              <Truck size={18} />
              Dispatch & Manifests
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'ndr' ? 'active' : ''}`}
              onClick={() => setActiveTab('ndr')}
            >
              <AlertTriangle size={18} />
              NDR Exceptions
              <span className="nav-badge badge-danger">{ndrList.length || 1}</span>
            </button>
          </li>
          <li>
            <button
              className={`nav-button ${activeTab === 'finance' ? 'active' : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              <DollarSign size={18} />
              COD & Reconciliation
              <span className="nav-badge badge-danger">1</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">SO</div>
            <div className="user-meta">
              <span className="user-name">Samuel O.</span>
              <span className="user-role">Operations Lead</span>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            title="Refresh System State"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="breadcrumbs">
            <span>Ship It Operations</span>
            <span>/</span>
            <strong>
              {activeTab === 'control-tower' && 'Fulfillment Control Tower'}
              {activeTab === 'scan-station' && 'Operations Scan Station (Route Safeguard)'}
              {activeTab === 'customer-care' && 'Customer Care & COD Verification'}
              {activeTab === 'wms-inventory' && 'Warehouse Management System (WMS)'}
              {activeTab === 'dispatch' && 'Route Manifests & Custody Handover'}
              {activeTab === 'ndr' && 'Real-Time Non-Delivery (NDR) Center'}
              {activeTab === 'finance' && 'COD Clearing & Rider Shift Reconciliation'}
            </strong>
          </div>

          <div className="top-actions">
            <div className="status-pill">
              <span className="pulse-dot"></span>
              Hub: Nairobi Industrial Area (WH-01)
            </div>
          </div>
        </header>

        <main className="content-body">
          {/* TAB 1: CONTROL TOWER */}
          {activeTab === 'control-tower' && (
            <>
              {/* Exceptions Tower Banner */}
              <div className="exception-tower">
                <div className="exception-title-row">
                  <div className="exception-heading">
                    <ShieldAlert size={20} color="#ef4444" />
                    <span>Active Control Tower Exceptions ({exceptions.filter((e) => !e.isResolved).length})</span>
                  </div>
                  <span className="badge-danger nav-badge">ATTENTION REQUIRED</span>
                </div>
                <div className="exception-list">
                  {exceptions
                    .filter((e) => !e.isResolved)
                    .map((exc) => (
                      <div key={exc.id} className="exception-item">
                        <div className="exception-info">
                          <h4>{exc.title}</h4>
                          <p>{exc.details}</p>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setExceptions((prev) =>
                              prev.map((item) =>
                                item.id === exc.id ? { ...item, isResolved: true } : item
                              )
                            );
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Today's Orders</span>
                    <Box size={18} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">{kpis.totalOrdersToday.toLocaleString()}</div>
                  <span className="kpi-subtitle">Across 3 onboarded merchants</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Out for Delivery</span>
                    <Truck size={18} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">{kpis.outForDelivery}</div>
                  <span className="kpi-subtitle">4 Active Rider Manifests</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Delivered & Closed</span>
                    <CheckCircle2 size={18} className="kpi-icon" style={{ color: 'var(--status-success)' }} />
                  </div>
                  <div className="kpi-value">{kpis.delivered}</div>
                  <span className="kpi-subtitle">87.6% First-Attempt Success</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">COD Collected (Today)</span>
                    <DollarSign size={18} className="kpi-icon" style={{ color: '#60a5fa' }} />
                  </div>
                  <div className="kpi-value">KES {(kpis.totalCodCollectedKes / 1000).toFixed(0)}K</div>
                  <span className="kpi-subtitle">M-Pesa (78%) + Cash (22%)</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Pending Verification</span>
                    <PhoneCall size={18} className="kpi-icon" style={{ color: 'var(--status-warning)' }} />
                  </div>
                  <div className="kpi-value">{kpis.pendingVerification}</div>
                  <span className="kpi-subtitle">Unconfirmed COD Phone Orders</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Active RTO Rate</span>
                    <AlertTriangle size={18} className="kpi-icon" style={{ color: 'var(--status-danger)' }} />
                  </div>
                  <div className="kpi-value">{kpis.rtoRatePct}%</div>
                  <span className="kpi-subtitle">Target: &lt; 6.0%</span>
                </div>
              </div>

              {/* Quick Actions & Live Operations Stream */}
              <div className="two-col-grid">
                <div className="table-container">
                  <div className="table-header-bar">
                    <span className="table-title">Live Warehouse Work Queues</span>
                    <span className="code-tag">ACTIVE SHIFT</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Queue Metric</th>
                        <th>Action Needed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Customer Care</strong></td>
                        <td>{kpis.pendingVerification} unverified COD orders</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveTab('customer-care')}
                          >
                            Open Queue
                          </button>
                        </td>
                        <td><span className="badge-warning nav-badge">Pending</span></td>
                      </tr>
                      <tr>
                        <td><strong>Warehouse Picking</strong></td>
                        <td>{kpis.readyToPick} orders ready for pick</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveTab('wms-inventory')}
                          >
                            Launch Wave
                          </button>
                        </td>
                        <td><span className="badge-info nav-badge">Ready</span></td>
                      </tr>
                      <tr>
                        <td><strong>Dispatch Hub</strong></td>
                        <td>{kpis.packed} parcels ready for staging</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveTab('scan-station')}
                          >
                            Scan Station
                          </button>
                        </td>
                        <td><span className="badge-success nav-badge">Staged</span></td>
                      </tr>
                      <tr>
                        <td><strong>Finance Cashier</strong></td>
                        <td>KES 1,000 cash shortage variance</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveTab('finance')}
                          >
                            Review Shift
                          </button>
                        </td>
                        <td><span className="badge-danger nav-badge">Locked</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="table-container">
                  <div className="table-header-bar">
                    <span className="table-title">Active Fleet Routes (Nairobi)</span>
                    <span className="code-tag">4 RIDERS ON ROAD</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Route Code</th>
                        <th>Rider</th>
                        <th>Stops</th>
                        <th>Expected COD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="code-tag">WESTLANDS-01</span></td>
                        <td>Peter Karanja (KMDF 221X)</td>
                        <td>24 parcels</td>
                        <td>KES 48,500</td>
                      </tr>
                      <tr>
                        <td><span className="code-tag">KILIMANI-02</span></td>
                        <td>John Mwangi (KMEE 810Z)</td>
                        <td>18 parcels</td>
                        <td>KES 32,000</td>
                      </tr>
                      <tr>
                        <td><span className="code-tag">THIKA-RD-01</span></td>
                        <td>Samuel Otieno (KMDF 904A)</td>
                        <td>29 parcels</td>
                        <td>KES 64,200</td>
                      </tr>
                      <tr>
                        <td><span className="code-tag">MOMBASA-RD-01</span></td>
                        <td>Francis Kamau (KMEC 112P)</td>
                        <td>14 parcels</td>
                        <td>KES 28,900</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: WAYBILL SCAN STATION (CORE DIFFERENTIATOR) */}
          {activeTab === 'scan-station' && (
            <div className="scan-station">
              <div>
                <h2>Operations Barcode Scan Terminal</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Prevents wrong-route misloads. Scanning a waybill instantly validates target destination and audio-alerts if parcel is routed to the wrong manifest.
                </p>
              </div>

              <form onSubmit={handleScanSubmit} className="scan-input-wrapper">
                <div className="scan-input-row">
                  <select
                    className="scan-route-select"
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                  >
                    <option value="WESTLANDS-01">Manifest: WESTLANDS-01</option>
                    <option value="KILIMANI-02">Manifest: KILIMANI-02</option>
                    <option value="THIKA-RD-01">Manifest: THIKA-RD-01</option>
                    <option value="MOMBASA-RD-01">Manifest: MOMBASA-RD-01</option>
                  </select>

                  <input
                    type="text"
                    className="scan-barcode-input"
                    placeholder="SCAN OR TYPE WAYBILL (e.g. WB-90412-KE, WB-90410-KE)..."
                    value={scanBarcode}
                    onChange={(e) => setScanBarcode(e.target.value)}
                    autoFocus
                  />

                  <button type="submit" className="btn btn-primary">
                    <Barcode size={18} />
                    Scan Barcode
                  </button>
                </div>
              </form>

              {/* Interactive Quick Scan Test Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>Quick Simulation Presets:</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScanBarcode('WB-90412-KE')}
                >
                  Test Westlands Parcel (WB-90412-KE)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setScanBarcode('WB-90410-KE')}
                >
                  Test Kilimani Parcel (WB-90410-KE)
                </button>
              </div>

              {/* Scan Feedback Banner */}
              {scanFeedback.status === 'success' && (
                <div className="scan-result-success">
                  <div>
                    <h3 style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={22} />
                      {scanFeedback.message}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      Recipient: Jane Wambui • Westlands, Rhapta Road • COD: KES 5,250
                    </p>
                  </div>
                  <span className="code-tag">ADDED TO MANIFEST</span>
                </div>
              )}

              {scanFeedback.status === 'error' && (
                <div className="scan-result-error">
                  <div>
                    <h3 style={{ color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <XCircle size={22} />
                      {scanFeedback.message}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      This parcel must NOT be loaded on {selectedRoute}. Please divert to staging zone {scanFeedback.correctRoute || 'KILIMANI-02'}.
                    </p>
                  </div>
                  <span className="badge-danger nav-badge">BLOCKED SCAN</span>
                </div>
              )}

              {/* Staged Parcels on active manifest */}
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <div className="table-header-bar">
                  <span className="table-title">Currently Manifested Parcels for {selectedRoute}</span>
                  <span className="code-tag">2 PARCELS READY</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Waybill</th>
                      <th>Merchant</th>
                      <th>Recipient</th>
                      <th>Destination</th>
                      <th>Expected COD</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="code-tag">WB-90414-KE</span></td>
                      <td>Safari Tech</td>
                      <td>Kevin Ouma</td>
                      <td>Westlands, Muthithi Road</td>
                      <td>KES 5,750</td>
                      <td><span className="badge-info nav-badge">Manifested</span></td>
                    </tr>
                    <tr>
                      <td><span className="code-tag">WB-90412-KE</span></td>
                      <td>BeautyGlow KE</td>
                      <td>Jane Wambui</td>
                      <td>Rhapta Road, Apt 3B</td>
                      <td>KES 5,250</td>
                      <td><span className="badge-success nav-badge">Verified</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER CARE VERIFICATION */}
          {activeTab === 'customer-care' && (
            <div className="table-container">
              <div className="table-header-bar">
                <div>
                  <span className="table-title">Pre-Dispatch COD Verification Queue</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    High-risk COD orders requiring phone confirmation of delivery landmark before warehouse picking begins.
                  </p>
                </div>
                <span className="badge-warning nav-badge">2 ORDERS PENDING CALL</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order Ref</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Address & Landmark</th>
                    <th>Order Items</th>
                    <th>COD Value</th>
                    <th>Verification Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="code-tag">ORD-90413</span></td>
                    <td><strong>Brian Kiprop</strong></td>
                    <td>+254 714 889 900</td>
                    <td>
                      <div>Kilimani, Dennis Pritt Rd</div>
                      <small style={{ color: 'var(--text-muted)' }}>Near State House Girls Primary Gate</small>
                    </td>
                    <td>1x Glow Radiance Serum 50ml</td>
                    <td><strong>KES 3,050</strong></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleVerifyOrder('ord-1002', true)}
                      >
                        <Check size={14} /> Confirm
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleVerifyOrder('ord-1002', false)}
                      >
                        <XCircle size={14} /> Cancel Fake
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td><span className="code-tag">ORD-90416</span></td>
                    <td><strong>Mercy Achieng</strong></td>
                    <td>+254 722 441 122</td>
                    <td>
                      <div>Roysambu, Lumumba Drive</div>
                      <small style={{ color: 'var(--text-muted)' }}>Blue Sky Apts, opposite Quickmart</small>
                    </td>
                    <td>1x Anker PowerCore 20k</td>
                    <td><strong>KES 5,750</strong></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => alert('Order ORD-90416 confirmed! Moved to picking queue.')}
                      >
                        <Check size={14} /> Confirm
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => alert('Order cancelled and reserved stock returned to inventory.')}
                      >
                        <XCircle size={14} /> Cancel Fake
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: WMS & INVENTORY */}
          {activeTab === 'wms-inventory' && (
            <div className="two-col-grid">
              <div className="table-container">
                <div className="table-header-bar">
                  <span className="table-title">Inventory Stock Levels (Warehouse Ledger)</span>
                  <span className="code-tag">IMMUTABLE LOG</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Available</th>
                      <th>Reserved</th>
                      <th>Damaged</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockList.map((st) => (
                      <tr key={st.productId}>
                        <td><span className="code-tag">{st.sku}</span></td>
                        <td>{st.productName}</td>
                        <td><strong style={{ color: 'var(--status-success)' }}>{st.availableQty}</strong></td>
                        <td>{st.reservedQty}</td>
                        <td>{st.damagedQty > 0 ? <span style={{ color: 'var(--status-danger)' }}>{st.damagedQty}</span> : 0}</td>
                        <td>
                          {st.availableQty < 15 ? (
                            <span className="badge-danger nav-badge">Low Stock</span>
                          ) : (
                            <span className="badge-success nav-badge">Healthy</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-container">
                <div className="table-header-bar">
                  <span className="table-title">Inbound ASN & Putaway Locations</span>
                  <span className="code-tag">GRN RECEIVING</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ASN #</th>
                      <th>Merchant</th>
                      <th>Expected Units</th>
                      <th>Storage Bin</th>
                      <th>GRN Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="code-tag">ASN-00192</span></td>
                      <td>BeautyGlow</td>
                      <td>150 Units</td>
                      <td><span className="code-tag">W1-A01-R01-S1-B01</span></td>
                      <td><span className="badge-success nav-badge">GRN-00192 Issued</span></td>
                    </tr>
                    <tr>
                      <td><span className="code-tag">ASN-00204</span></td>
                      <td>Safari Tech</td>
                      <td>180 Units</td>
                      <td><span className="code-tag">W1-B02-R04-S2-B01</span></td>
                      <td><span className="badge-warning nav-badge">Expected Oct 10</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DISPATCH & MANIFESTS */}
          {activeTab === 'dispatch' && (
            <div className="table-container">
              <div className="table-header-bar">
                <span className="table-title">Daily Dispatch Manifests & Custody Handover</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => alert('New route manifest generated!')}
                >
                  + New Run Sheet
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Manifest #</th>
                    <th>Route</th>
                    <th>Assigned Rider</th>
                    <th>Vehicle Plate</th>
                    <th>Parcels</th>
                    <th>Expected COD</th>
                    <th>Custody Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="code-tag">MNF-2026-0881</span></td>
                    <td>WESTLANDS-01</td>
                    <td>Peter Karanja</td>
                    <td>KMDF 221X</td>
                    <td>2 Parcels</td>
                    <td>KES 9,800</td>
                    <td><span className="badge-info nav-badge">In Transit</span></td>
                  </tr>
                  <tr>
                    <td><span className="code-tag">MNF-2026-0882</span></td>
                    <td>KILIMANI-02</td>
                    <td>John Mwangi</td>
                    <td>KMEE 810Z</td>
                    <td>18 Parcels</td>
                    <td>KES 32,000</td>
                    <td><span className="badge-info nav-badge">In Transit</span></td>
                  </tr>
                  <tr>
                    <td><span className="code-tag">MNF-2026-0883</span></td>
                    <td>THIKA-RD-01</td>
                    <td>Samuel Otieno</td>
                    <td>KMDF 904A</td>
                    <td>29 Parcels</td>
                    <td>KES 64,200</td>
                    <td><span className="badge-success nav-badge">Staged</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: NDR CENTER */}
          {activeTab === 'ndr' && (
            <div className="table-container">
              <div className="table-header-bar">
                <div>
                  <span className="table-title">Non-Delivery Reports (NDR Control Tower)</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Immediate intervention while rider is still within the delivery neighborhood to prevent costly RTOs.
                  </p>
                </div>
                <span className="badge-danger nav-badge">1 CRITICAL NDR</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Area</th>
                    <th>Rider</th>
                    <th>Failure Reason</th>
                    <th>Customer Care Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="code-tag">ORD-90410</span></td>
                    <td><strong>Diana Chebet</strong></td>
                    <td>+254 722 880 011</td>
                    <td>Kilimani, Argwings Kodhek</td>
                    <td>John Mwangi</td>
                    <td><span className="badge-danger nav-badge">CUSTOMER UNREACHABLE</span></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => alert('Dialing +254 722 880 011...')}
                      >
                        <PhoneCall size={14} /> Call Now
                      </button>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleResolveNdr('ndr-01', 'RETRY')}
                      >
                        Retry Rider Stop
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleResolveNdr('ndr-01', 'RTO')}
                      >
                        Mark RTO
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: FINANCE & COD */}
          {activeTab === 'finance' && (
            <div className="two-col-grid">
              <div className="table-container">
                <div className="table-header-bar">
                  <span className="table-title">Rider Shift Reconciliation (Cash & M-Pesa)</span>
                  <span className="badge-danger nav-badge">1 VARIANCE DETECTED</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Expected COD</th>
                      <th>M-Pesa Verified</th>
                      <th>Cash Expected</th>
                      <th>Cash Handed In</th>
                      <th>Variance</th>
                      <th>Shift Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Peter Karanja</strong></td>
                      <td>KES 48,500</td>
                      <td>KES 30,000</td>
                      <td>KES 18,500</td>
                      <td>KES 17,500</td>
                      <td><strong style={{ color: 'var(--status-danger)' }}>-KES 1,000</strong></td>
                      <td><span className="badge-danger nav-badge">Shift Locked</span></td>
                    </tr>
                    <tr>
                      <td><strong>John Mwangi</strong></td>
                      <td>KES 32,000</td>
                      <td>KES 22,000</td>
                      <td>KES 10,000</td>
                      <td>KES 10,000</td>
                      <td><strong style={{ color: 'var(--status-success)' }}>KES 0</strong></td>
                      <td><span className="badge-success nav-badge">Closed</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="table-container">
                <div className="table-header-bar">
                  <span className="table-title">Merchant Settlements Ledger</span>
                  <span className="code-tag">WEEKLY CLEARING</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Gross COD</th>
                      <th>Fees Deducted</th>
                      <th>Net Payout</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>BeautyGlow KE</strong></td>
                      <td>KES 210,000</td>
                      <td>KES 18,500</td>
                      <td><strong>KES 191,500</strong></td>
                      <td><span className="badge-success nav-badge">Disbursed via B2C</span></td>
                    </tr>
                    <tr>
                      <td><strong>Safari Tech</strong></td>
                      <td>KES 145,000</td>
                      <td>KES 12,800</td>
                      <td><strong>KES 132,200</strong></td>
                      <td><span className="badge-info nav-badge">Pending Approval</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
