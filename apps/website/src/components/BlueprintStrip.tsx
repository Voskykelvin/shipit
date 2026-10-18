import React from 'react';
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  PackageCheck,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';

export function BlueprintStrip() {
  const stages = [
    {
      title: '1. Inbound Cargo',
      subtitle: 'Mombasa / ICD receiving',
      icon: <Warehouse size={18} />,
    },
    {
      title: '2. High-Bay Putaway',
      subtitle: 'Barcoded pallet bays',
      icon: <Boxes size={18} />,
    },
    {
      title: '3. Fraud Pre-Check',
      subtitle: 'RTO phone verification',
      icon: <ShieldCheck size={18} />,
    },
    {
      title: '4. Wave Pick & Pack',
      subtitle: 'Thermal 4x6 waybills',
      icon: <PackageCheck size={18} />,
    },
    {
      title: '5. Zoned Manifest',
      subtitle: 'Route barcode verification',
      icon: <FileCheck2 size={18} />,
    },
    {
      title: '6. Courier Dispatch',
      subtitle: 'GPS fleet & rider app',
      icon: <Truck size={18} />,
    },
    {
      title: '7. M-Pesa STK COD',
      subtitle: 'Instant phone payment',
      icon: <CircleDollarSign size={18} />,
    },
    {
      title: '8. Bank Remittance',
      subtitle: 'T+1 automated payout',
      icon: <ClipboardCheck size={18} />,
    },
  ];

  return (
    <div className="container" id="how-it-works" style={{ margin: '3.5rem auto 1.5rem' }}>
      <div
        style={{
          background: 'var(--navy-primary)',
          color: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          padding: '2.25rem',
          border: '1px solid var(--navy-border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.35rem', color: '#ffffff' }}>The Physical Closed-Loop Chain of Custody</h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              From maritime container intake at Mombasa Port to verified M-Pesa bank disbursement in Nairobi.
            </span>
          </div>
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: 'var(--amber-safety)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <ShieldCheck size={14} /> ZERO UNTRACKED INVENTORY MOVEMENTS
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          {stages.map((stage, index) => (
            <div
              key={stage.title}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  color: 'var(--amber-safety)',
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                {stage.icon}
              </div>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#ffffff', marginBottom: '0.15rem' }}>
                {stage.title}
              </strong>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{stage.subtitle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
