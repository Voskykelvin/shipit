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
      title: '1. Inbound ASN',
      subtitle: 'Truck dock receiving',
      icon: <Warehouse size={18} />,
    },
    {
      title: '2. Putaway Bins',
      subtitle: 'Barcoded locations',
      icon: <Boxes size={18} />,
    },
    {
      title: '3. Fraud Shield',
      subtitle: 'COD pre-dispatch check',
      icon: <ShieldCheck size={18} />,
    },
    {
      title: '4. Wave Pick & Pack',
      subtitle: '4x6 Thermal waybills',
      icon: <PackageCheck size={18} />,
    },
    {
      title: '5. Zoned Manifest',
      subtitle: 'Route audio validation',
      icon: <FileCheck2 size={18} />,
    },
    {
      title: '6. Last-Mile Rider',
      subtitle: 'PWA camera scanning',
      icon: <Truck size={18} />,
    },
    {
      title: '7. M-Pesa STK Push',
      subtitle: 'Instant COD clearing',
      icon: <CircleDollarSign size={18} />,
    },
    {
      title: '8. Ledger Settlement',
      subtitle: 'Zero variance closeout',
      icon: <ClipboardCheck size={18} />,
    },
  ];

  return (
    <div className="container" id="how-it-works">
      <div className="blueprint-strip">
        <div className="blueprint-header">
          <div>
            <h3>
              The Closed-Loop Chain of Custody
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              From initial container unboxing to verified M-Pesa bank disbursement.
            </span>
          </div>
          <div className="zero-untracked-badge">
            <ShieldCheck size={14} /> ZERO UNTRACKED MOVEMENTS
          </div>
        </div>

        <div className="flow-stages">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.title}>
              <div className="flow-node">
                <div className="flow-node-icon">{stage.icon}</div>
                <strong>{stage.title}</strong>
                <span>{stage.subtitle}</span>
              </div>
              {index < stages.length - 1 && (
                <div className="flow-arrow">
                  <ArrowRight size={16} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
