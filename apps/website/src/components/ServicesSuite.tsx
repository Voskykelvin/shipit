import React, { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  Globe2,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';

interface ServicesSuiteProps {
  onOpenLeadModal: () => void;
}

export function ServicesSuite({ onOpenLeadModal }: ServicesSuiteProps) {
  const [activeTab, setActiveTab] = useState<'warehousing' | 'courier' | 'cod' | 'fleet' | 'freight'>('warehousing');

  const services = {
    warehousing: {
      id: 'warehousing',
      tabLabel: 'Pallet & Carton Storage',
      icon: <Warehouse size={18} className="tab-icon" />,
      eyebrow: 'CONTRACT 3PL WAREHOUSING',
      title: 'High-Bay Pallet Storage & WMS Inventory Control',
      photo: '/images/warehouse-highbay.png',
      badge: '15,000+ Pallet Positions · Nairobi Industrial Area',
      description:
        'Secure multi-tier high-bay racking designed for manufacturers, bulk importers, and retail distributors. Whether you require 10 pallet spaces or 2,000 pallet bays, our facility provides clean, barcoded, and bonded storage with zero untracked inventory.',
      points: [
        'Multi-tier industrial racking with barcode-addressed aisles and bin locations',
        'Inbound container de-stuffing, palletizing, and stretch-wrapping',
        'Batch number, serial number, and expiration (FEFO / FIFO) compliance tracking',
        '24/7 CCTV surveillance, biometric security, smoke detection, and full insurance coverage',
        'Real-time cloud WMS portal with live stock alerts and automated re-order levels',
      ],
      ctaText: 'Book a Warehouse Hub Tour',
    },
    courier: {
      id: 'courier',
      tabLabel: 'Countrywide Courier',
      icon: <Truck size={18} className="tab-icon" />,
      eyebrow: 'LAST-MILE EXPRESS COURIER',
      title: 'Same-Day Nairobi & 24H Countrywide Distribution',
      photo: '/images/courier-handover.jpg',
      badge: '47 Counties Covered · 99.4% On-Time Delivery',
      description:
        'Fast, reliable, and trackable doorstep delivery for commercial parcels, cartons, and consumer goods. Our zoned dispatch routing ensures rapid transit times across Greater Nairobi and all major upcountry trade centers.',
      points: [
        'Intra-Nairobi 3-4 Hour Express & Same-Day delivery across 48 metropolitan zones',
        'Next-day (24-hour) scheduled delivery to Mombasa, Nakuru, Eldoret, Kisumu, Nyeri & Meru',
        'Specialized handling for fragile cosmetics, electronics, and high-value consignments',
        'Automated thermal 4x6 waybills with barcode scanning at every handover checkpoint',
        'Recipient SMS and WhatsApp notifications with live driver dispatch updates',
      ],
      ctaText: 'Ship Consignments Countrywide',
    },
    cod: {
      id: 'cod',
      tabLabel: 'Pay on Delivery (COD)',
      icon: <Coins size={18} className="tab-icon" />,
      eyebrow: 'DUAL-CHANNEL COD REMITTANCE',
      title: 'Guaranteed Doorstep M-Pesa & Cash Collection',
      photo: '/images/courier-handover.jpg',
      badge: 'Zero Cash Leakage · Next-Morning Bank Remittance',
      description:
        'In East Africa, Pay on Delivery is the lifeblood of customer trust. Ship It provides a completely auditable Cash-on-Delivery clearing engine powered by direct Safaricom M-Pesa STK Push prompts and shift-locked cash reconciliation.',
      points: [
        'Instant STK Push triggered to customer handset upon parcel inspection — no manual Paybill typing',
        'Shift-locked cashier reconciliation: riders cannot close shifts with unverified cash',
        'Next-morning (T+1) automated remittance directly to your bank account or Paybill',
        'Automated Pre-Dispatch customer verification to slash failed deliveries and RTO returns by 60%',
        'Real-time financial dashboard with downloadable ledger entries and zero discrepancies',
      ],
      ctaText: 'Enable Pay on Delivery',
    },
    fleet: {
      id: 'fleet',
      tabLabel: 'Rider & Fleet Hire',
      icon: <Truck size={18} className="tab-icon" />,
      eyebrow: 'DEDICATED FLEET OUTSOURCING',
      title: 'Contract Motorcycle Couriers & Commercial Box Trucks',
      photo: '/images/courier-handover.jpg',
      badge: 'GPS Telematics Fleet · Vetted & Uniformed Drivers',
      description:
        'Eliminate the capital expenditure, mechanical maintenance, and staffing headaches of running your own transport department. Outsource your distribution to our dedicated, branded delivery fleet.',
      points: [
        'Motorcycle couriers equipped with high-capacity lockable, weatherproof delivery boxes',
        '1-Tonne, 3-Tonne, 5-Tonne, and 10-Tonne closed box trucks for B2B supermarket & wholesale runs',
        'Real-time GPS telematics tracking, route optimization, and speed monitoring',
        'Professional, vetted, and uniformed riders trained in corporate customer etiquette',
        'Guaranteed standby backup vehicles to ensure zero interruption during fleet servicing',
      ],
      ctaText: 'Hire Dedicated Fleet',
    },
    freight: {
      id: 'freight',
      tabLabel: 'Inbound & Outbound Customs',
      icon: <Globe2 size={18} className="tab-icon" />,
      eyebrow: 'REGIONAL FREIGHT & CROSS-DOCKING',
      title: 'Port of Mombasa Clearing & Cross-Border East Africa',
      photo: '/images/warehouse-operations.jpg',
      badge: 'Mombasa Port · ICD Embakasi · EAC Cross-Border Corridors',
      description:
        'Seamless gateway services connecting global manufacturing ports with East African retail markets. We manage the entire transition from maritime container arrival to cross-border road freight.',
      points: [
        'Port of Mombasa sea container receiving & direct bonded rail haulage to ICD Embakasi',
        'Jomo Kenyatta International Airport (JKIA) air freight cargo retrieval and customs processing',
        'Cross-docking and container de-stuffing directly into our central Nairobi distribution racks',
        'Cross-border bonded road freight into Uganda (Kampala), Tanzania (Arusha/Dar), and Rwanda',
        'Simplified COMESA cross-border customs documentation and transit escort coordination',
      ],
      ctaText: 'Inquire About Regional Freight',
    },
  };

  const current = services[activeTab];

  return (
    <section className="section-pad services-section" id="services">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge">
            <Boxes size={14} /> COMPLETE 3PL &amp; COURIER CAPABILITIES
          </span>
          <h2 className="section-title">
            Our Core Logistics <span className="text-blue">Service Suite.</span>
          </h2>
          <p className="section-sub">
            From single-pallet contract storage in Nairobi to nationwide daily distribution and automated
            pay-on-delivery clearing, we handle your entire physical chain of custody.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="services-tab-bar">
          {(Object.keys(services) as Array<keyof typeof services>).map((key) => (
            <button
              key={key}
              className={`service-tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {services[key].icon}
              <span>{services[key].tabLabel}</span>
            </button>
          ))}
        </div>

        {/* Active Tab Showcase Card */}
        <div className="service-showcase-card">
          {/* Photo Column */}
          <div className="service-photo-col">
            <img src={current.photo} alt={current.title} className="service-photo" />
            <div className="service-photo-badge">
              <ShieldCheck size={16} color="#f59e0b" />
              <span>{current.badge}</span>
            </div>
          </div>

          {/* Details & Copy Column */}
          <div className="service-content-col">
            <span className="service-eyebrow">{current.eyebrow}</span>
            <h3 className="service-title">{current.title}</h3>
            <p className="service-desc">{current.description}</p>

            <div className="service-points-list">
              {current.points.map((pt, i) => (
                <div className="service-point-item" key={i}>
                  <CheckCircle2 size={18} />
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn btn-primary btn-lg" onClick={onOpenLeadModal}>
                {current.ctaText} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
