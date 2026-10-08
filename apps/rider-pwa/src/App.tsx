import React, { useState } from 'react';
import {
  Phone,
  MessageSquare,
  Navigation,
  CheckCircle2,
  XCircle,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Bike,
  ArrowRight,
} from 'lucide-react';

interface Stop {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  area: string;
  landmark: string;
  items: string;
  codAmountKes: number;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
}

export default function App() {
  const [stops, setStops] = useState<Stop[]>([
    {
      id: 'stop-01',
      orderNumber: 'ORD-90412',
      customerName: 'Jane Wambui',
      phone: '+254712345678',
      area: 'Westlands, Rhapta Road',
      landmark: 'Parkview Heights, Apt 3B (Opposite Shell, Pink Gate)',
      items: '1x Glow Radiance Serum, 1x Hydrating Day Cream',
      codAmountKes: 5250,
      status: 'PENDING',
    },
    {
      id: 'stop-02',
      orderNumber: 'ORD-90414',
      customerName: 'Kevin Ouma',
      phone: '+254728554433',
      area: 'Westlands, Muthithi Road',
      landmark: 'Muthithi Road Offices, 2nd Fl above DTB Bank',
      items: '1x Anker PowerCore 20k',
      codAmountKes: 5750,
      status: 'PENDING',
    },
    {
      id: 'stop-03',
      orderNumber: 'ORD-90418',
      customerName: 'Stephen Maina',
      phone: '+254720991122',
      area: 'Parklands, 4th Avenue',
      landmark: 'Avenue Towers, Gate 2',
      items: '1x Wireless Earbuds Pro',
      codAmountKes: 3800,
      status: 'PENDING',
    },
  ]);

  const [activeStop, setActiveStop] = useState<Stop | null>(stops[0]);
  const [showPodModal, setShowPodModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'MPESA' | 'CASH'>('MPESA');
  const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [cashCollected, setCashCollected] = useState(18500);
  const [mpesaCollected, setMpesaCollected] = useState(30000);

  const handleTriggerStk = () => {
    setStkStatus('sending');
    setTimeout(() => {
      setStkStatus('success');
    }, 1500);
  };

  const handleFinalizeDelivery = () => {
    if (!activeStop) return;
    const amount = activeStop.codAmountKes;

    if (paymentMode === 'MPESA') {
      setMpesaCollected((prev) => prev + amount);
    } else {
      setCashCollected((prev) => prev + amount);
    }

    setStops((prev) =>
      prev.map((s) => (s.id === activeStop.id ? { ...s, status: 'DELIVERED' } : s))
    );

    setShowPodModal(false);
    setStkStatus('idle');

    // Move to next pending stop
    const next = stops.find((s) => s.id !== activeStop.id && s.status === 'PENDING');
    setActiveStop(next || null);
    alert(`Stop for ${activeStop.customerName} successfully delivered and COD recorded!`);
  };

  const handleFailDelivery = (reason: string) => {
    if (!activeStop) return;
    setStops((prev) =>
      prev.map((s) => (s.id === activeStop.id ? { ...s, status: 'FAILED' } : s))
    );
    setShowFailModal(false);

    // Call API / log NDR
    fetch('/api/delivery/fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: activeStop.orderNumber,
        riderId: 'rdr-001',
        failureReason: reason,
      }),
    }).catch(() => null);

    const next = stops.find((s) => s.id !== activeStop.id && s.status === 'PENDING');
    setActiveStop(next || null);
    alert(`NDR Alert raised! Customer Care has been alerted to call ${activeStop.customerName} immediately.`);
  };

  const pendingCount = stops.filter((s) => s.status === 'PENDING').length;

  return (
    <div className="rider-shell">
      {/* Header */}
      <header className="rider-header">
        <div className="rider-badge">
          <div className="r-avatar">PK</div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Peter Karanja</h3>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Route: WESTLANDS-01 • KMDF 221X</span>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>
          ● ON DUTY
        </div>
      </header>

      {/* Stats Bar */}
      <div className="r-stats-bar">
        <div className="r-stat-box">
          <span>Stops Remaining</span>
          <h2>{pendingCount} of {stops.length}</h2>
        </div>
        <div className="r-stat-box">
          <span>Total COD Collected</span>
          <h2 style={{ color: '#34d399' }}>KES {(cashCollected + mpesaCollected).toLocaleString()}</h2>
        </div>
      </div>

      {/* Stops List */}
      <div className="stops-scroll">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Delivery Run Sheet
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Manifest #MNF-0881</span>
        </div>

        {stops.map((stop, index) => {
          const isCurrent = activeStop?.id === stop.id;
          return (
            <div
              key={stop.id}
              className={`stop-card ${isCurrent ? 'active-stop' : ''}`}
              onClick={() => stop.status === 'PENDING' && setActiveStop(stop)}
            >
              <div className="stop-top">
                <span className={`stop-tag ${isCurrent ? 'tag-active' : ''}`}>
                  Stop #{index + 1} • {stop.orderNumber}
                </span>
                {stop.status === 'DELIVERED' && (
                  <span style={{ color: 'var(--status-green)', fontSize: '0.8rem', fontWeight: 700 }}>
                    ✓ Delivered
                  </span>
                )}
                {stop.status === 'FAILED' && (
                  <span style={{ color: 'var(--status-red)', fontSize: '0.8rem', fontWeight: 700 }}>
                    ⚠ NDR Escalated
                  </span>
                )}
                {stop.status === 'PENDING' && (
                  <span style={{ color: '#38bdf8', fontSize: '0.8rem' }}>Pending</span>
                )}
              </div>

              <div>
                <div className="stop-cust">{stop.customerName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stop.area}</div>
              </div>

              <div className="stop-landmark">
                <strong>📍 Landmark:</strong> {stop.landmark}
              </div>

              <div className="stop-cod">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>COD to Collect:</span>
                <strong>KES {stop.codAmountKes.toLocaleString()}</strong>
              </div>

              {/* Stop Actions (if active & pending) */}
              {isCurrent && stop.status === 'PENDING' && (
                <>
                  <div className="rider-action-row">
                    <a href={`tel:${stop.phone}`} className="r-btn r-btn-call">
                      <Phone size={15} /> Call
                    </a>
                    <a
                      href={`https://wa.me/${stop.phone.replace('+', '')}?text=Hello%20${stop.customerName},%20I%20am%20your%20Ship%20It%20rider`}
                      target="_blank"
                      rel="noreferrer"
                      className="r-btn r-btn-wa"
                    >
                      <MessageSquare size={15} /> WhatsApp
                    </a>
                    <a
                      href="https://maps.google.com/?q=Westlands+Nairobi"
                      target="_blank"
                      rel="noreferrer"
                      className="r-btn r-btn-maps"
                    >
                      <Navigation size={15} /> Maps
                    </a>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      className="r-btn r-btn-deliver"
                      onClick={() => setShowPodModal(true)}
                    >
                      <CheckCircle2 size={18} /> Confirm & Collect
                    </button>
                    <button
                      className="r-btn r-btn-fail"
                      onClick={() => setShowFailModal(true)}
                    >
                      <XCircle size={16} /> Failed
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* POD / COD PAYMENT MODAL */}
      {showPodModal && activeStop && (
        <div className="modal-sheet">
          <div className="sheet-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Complete Delivery & Collect COD</h3>
              <button
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setShowPodModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: 10 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer: {activeStop.customerName}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                Amount: KES {activeStop.codAmountKes.toLocaleString()}
              </div>
            </div>

            {/* Payment Channel Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                style={{
                  padding: '0.75rem',
                  borderRadius: 10,
                  border: paymentMode === 'MPESA' ? '2px solid #10b981' : '1px solid #334155',
                  background: paymentMode === 'MPESA' ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMode('MPESA')}
              >
                📱 M-Pesa STK Push
              </button>
              <button
                type="button"
                style={{
                  padding: '0.75rem',
                  borderRadius: 10,
                  border: paymentMode === 'CASH' ? '2px solid #38bdf8' : '1px solid #334155',
                  background: paymentMode === 'CASH' ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMode('CASH')}
              >
                💵 Physical Cash
              </button>
            </div>

            {paymentMode === 'MPESA' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Sends an instant Lipa Na M-Pesa prompt directly to customer's phone ({activeStop.phone}).
                </p>
                {stkStatus === 'idle' && (
                  <button
                    className="r-btn"
                    style={{ background: '#16a34a', width: '100%' }}
                    onClick={handleTriggerStk}
                  >
                    Send STK Prompt to Customer Phone
                  </button>
                )}
                {stkStatus === 'sending' && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', color: '#f59e0b', fontSize: '0.85rem' }}>
                    ⏳ Waiting for customer to enter PIN on handset...
                  </div>
                )}
                {stkStatus === 'success' && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: 8, color: '#34d399', fontSize: '0.85rem' }}>
                    ✓ M-Pesa Confirmed: QJD891K20L Verified!
                  </div>
                )}
              </div>
            )}

            {paymentMode === 'CASH' && (
              <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: 8, fontSize: '0.8rem', color: '#94a3b8' }}>
                Rider Peter Karanja confirms receipt of KES {activeStop.codAmountKes.toLocaleString()} in physical notes into secure pouch.
              </div>
            )}

            <button
              className="r-btn r-btn-deliver"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={handleFinalizeDelivery}
            >
              Sign Off & Complete Stop
            </button>
          </div>
        </div>
      )}

      {/* FAILED DELIVERY / NDR MODAL */}
      {showFailModal && activeStop && (
        <div className="modal-sheet">
          <div className="sheet-content">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-red)' }}>
              Report Delivery Exception (NDR)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Customer Care will be immediately notified while you are in the neighborhood to attempt recovery.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="r-btn"
                style={{ background: '#1e293b', justifyContent: 'flex-start', padding: '0.75rem' }}
                onClick={() => handleFailDelivery('CUSTOMER_UNREACHABLE')}
              >
                🔴 Customer Unreachable (Phone Off / No Answer)
              </button>
              <button
                className="r-btn"
                style={{ background: '#1e293b', justifyContent: 'flex-start', padding: '0.75rem' }}
                onClick={() => handleFailDelivery('RESCHEDULE_REQUESTED')}
              >
                🟠 Customer Requested Reschedule
              </button>
              <button
                className="r-btn"
                style={{ background: '#1e293b', justifyContent: 'flex-start', padding: '0.75rem' }}
                onClick={() => handleFailDelivery('WRONG_LOCATION')}
              >
                🟡 Address / Landmark Incorrect
              </button>
              <button
                className="r-btn"
                style={{ background: '#1e293b', justifyContent: 'flex-start', padding: '0.75rem' }}
                onClick={() => handleFailDelivery('REFUSED_DELIVERY')}
              >
                ⚪ Customer Refused Package
              </button>
            </div>

            <button
              style={{ padding: '0.75rem', background: 'transparent', border: '1px solid #334155', borderRadius: 10, color: '#fff', cursor: 'pointer' }}
              onClick={() => setShowFailModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
