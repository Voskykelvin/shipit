import React from 'react';
import {
  Boxes,
  Briefcase,
  Cpu,
  Factory,
  Package,
  Pill,
  ShoppingBag,
  Truck,
  Wrench,
} from 'lucide-react';

export function IndustrySolutions() {
  const industries = [
    {
      icon: <Factory size={26} />,
      title: 'Manufacturers & FMCG Producers',
      description:
        'Inbound container reception from Mombasa, offloading and palletized high-bay storage. Scheduled wholesale truck runs to supermarkets, distributors, and regional retail outlets with automated proof-of-delivery.',
      badge: 'Bulk Pallet Intake · FEFO Batching',
    },
    {
      icon: <Pill size={26} />,
      title: 'Pharmaceuticals & Health Products',
      description:
        'Regulated supply chain custody designed to eliminate counterfeit risks. Dust-free, temperature-monitored storage, sealed tamper-evident dispatch, and express courier runs to hospitals, clinics, and pharmacies.',
      badge: 'Clean Custody · Serial Traceability',
    },
    {
      icon: <Cpu size={26} />,
      title: 'Electronics & Hardware Importers',
      description:
        'Secure high-value caged storage with individual serial barcode scans upon intake. We handle everything from smartphone consignments to heavy industrial hardware with dedicated closed box trucks.',
      badge: 'High-Value Security · Heavy Goods',
    },
    {
      icon: <ShoppingBag size={26} />,
      title: 'eCommerce & Consumer Brands',
      description:
        'End-to-end fulfillment for high-velocity online sellers. Pre-dispatch phone/WhatsApp fraud screening, same-day Nairobi courier, countrywide 24H transit, and doorstep Pay-on-Delivery with daily remittance.',
      badge: 'Pay on Delivery · RTO Protection',
    },
  ];

  return (
    <section className="section-pad industry-section" id="solutions">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge">
            <Briefcase size={14} /> TAILORED SECTOR WORKFLOWS
          </span>
          <h2 className="section-title">
            Purpose-Built for <span className="text-blue">Distributors &amp; Manufacturers.</span>
          </h2>
          <p className="section-sub">
            Whether you are moving 50 metric tons of fast-moving consumer goods or fulfilling 5,000 monthly
            customer parcels, our operations are tuned to your specific commercial requirements.
          </p>
        </div>

        <div className="industry-grid">
          {industries.map((item) => (
            <div className="industry-card" key={item.title}>
              <div className="industry-icon-wrap">{item.icon}</div>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
              <span className="industry-badge">{item.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
