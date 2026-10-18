import React from 'react';
import {
  AlertTriangle,
  Banknote,
  Cpu,
  Layers,
  MapPin,
  ShieldAlert,
  Smartphone,
  Zap,
} from 'lucide-react';

export function Features() {
  const features = [
    {
      title: 'Kenya-Specific Landmark Intelligence',
      tag: 'Localized Geocoding',
      description:
        'Emerging trade corridors lack rigid postal codes. Ship It resolves localized destination addressing across County, Sub-County, Estate, and Landmarks (e.g. "Opposite Total Energies, black gate") with direct WhatsApp GPS pins.',
      icon: <MapPin size={24} color="#1d4ed8" />,
    },
    {
      title: 'Pre-Dispatch Fraud Shield (COD Verification)',
      tag: 'RTO Elimination',
      description:
        'High-value or Cash-on-Delivery consignments automatically route through our phone and WhatsApp confirmation desk before pickers touch warehouse inventory, slashing failed deliveries and return costs by up to 60%.',
      icon: <ShieldAlert size={24} color="#f59e0b" />,
    },
    {
      title: 'Real-Time NDR Exception Interception',
      tag: 'Immediate Delivery Rescue',
      description:
        'When a delivery rider flags a stop as "customer unavailable", Customer Care gets an instant audio alert to phone the recipient immediately while the courier is still parked on site.',
      icon: <AlertTriangle size={24} color="#dc2626" />,
    },
    {
      title: 'Automated Daraja M-Pesa Engine',
      tag: 'Instant Payment Matching',
      description:
        'Dual-mode settlement: rider triggers an automated STK Push prompt directly to customer handset upon parcel inspection, or recipient pays company Paybill with instant webhook ledger matching.',
      icon: <Smartphone size={24} color="#059669" />,
    },
    {
      title: 'Shift-Locked Cashier Reconciliation',
      tag: 'Auditable Finance',
      description:
        'Couriers returning to our hubs must reconcile collected cash notes and verified M-Pesa statements with the shift cashier. Any discrepancy locks shift closure until a manager approves with an audit reason.',
      icon: <Banknote size={24} color="#0284c7" />,
    },
    {
      title: 'Append-Only Ledger Architecture',
      tag: 'Enterprise Integrity',
      description:
        'No silent database overrides. Every pallet movement, item picked, and shilling collected is recorded in immutable financial and stock transaction ledgers with strict multi-tenant isolation.',
      icon: <Layers size={24} color="#7c3aed" />,
    },
  ];

  return (
    <section className="section-pad" id="architecture" style={{ background: '#ffffff', borderTop: '1px solid var(--border-light)' }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge">
            <Cpu size={14} /> PURPOSE-BUILT LOGISTICS INTELLIGENCE
          </span>
          <h2 className="section-title">
            Engineered for the Realities of <span className="text-blue">Kenyan Distribution.</span>
          </h2>
          <p className="section-sub">
            Traditional Western logistics software fails in East Africa because it assumes street numbers,
            prepaid credit cards, and formal zip codes. Ship It is purpose-built for high-velocity physical
            commerce, Cash-on-Delivery, and mobile money.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.75rem',
          }}
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.85rem',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: '#ffffff',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {feature.icon}
              </div>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: 'var(--blue-brand)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '0.35rem',
                }}
              >
                {feature.tag}
              </span>
              <h3 style={{ fontSize: '1.18rem', color: 'var(--navy-deep)', marginBottom: '0.65rem' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: 1.6, flexGrow: 1 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
