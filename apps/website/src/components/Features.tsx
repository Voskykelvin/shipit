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
      title: 'Kenya-Specific Address Intelligence',
      tag: 'Localized Geocoding',
      description:
        'Emerging markets lack rigid zip codes. Ship It resolves non-standard addressing across County, Sub-County, Estate, Floor/Unit, and Landmark descriptions (e.g. "Opposite Total Energies, black gate") with WhatsApp GPS pins.',
      icon: <MapPin size={24} />,
    },
    {
      title: 'Pre-Dispatch Fraud Shield (COD Verification)',
      tag: 'RTO Elimination',
      description:
        'High-risk or COD orders route through an automated phone/WhatsApp verification queue before warehouse pickers touch inventory, slashing fake orders and Return-to-Origin rates by up to 60%.',
      icon: <ShieldAlert size={24} />,
    },
    {
      title: 'Real-Time NDR Interception',
      tag: 'Immediate Rescue',
      description:
        'When a delivery rider flags a stop as "customer unavailable", Customer Care gets an instant high-priority alert to phone the customer immediately while the rider is still on the same street.',
      icon: <AlertTriangle size={24} />,
    },
    {
      title: 'Automated Daraja M-Pesa Engine',
      tag: 'Zero-Friction Payments',
      description:
        'Dual-mode settlement: rider triggers an instant STK Push directly to customer handset, or customer pays merchant Paybill with instant webhook ledger matching. No manual receipt re-typing.',
      icon: <Smartphone size={24} />,
    },
    {
      title: 'Shift-Locked Cash Clearing',
      tag: 'Auditable Finance',
      description:
        'Riders returning to the hub must reconcile handed-in physical notes and verified M-Pesa statements. Any variance locks shift closure until a manager reviews and signs off with an audit reason.',
      icon: <Banknote size={24} />,
    },
    {
      title: 'Immutable Ledger Architecture',
      tag: 'Enterprise Integrity',
      description:
        'No silent database overrides. Every inventory movement and every shilling collected is recorded in append-only financial and stock transaction logs with rigorous multi-tenant isolation.',
      icon: <Layers size={24} />,
    },
  ];

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">
            <Cpu size={14} /> Built For Emerging Physical Commerce
          </div>
          <h2>
            Engineered from the ground up for <span className="gradient-text">East African logistics.</span>
          </h2>
          <p>
            Standard Western logistics suites fail in Nairobi because they assume street numbers,
            prepaid credit cards, and postal codes. Ship It is purpose-built for the reality of Cash-on-Delivery
            and mobile money.
          </p>
        </div>

        <div className="grid-3">
          {features.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="feature-icon-wrapper">{feature.icon}</div>
              <span className="feature-tag">{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
