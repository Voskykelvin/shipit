import React from 'react';
import { Anchor, Building2, CheckCircle2, Globe2, MapPin, ShieldCheck, Truck, Warehouse } from 'lucide-react';

export function AboutUs() {
  const nodes = [
    {
      code: 'HUB-NBO-01',
      tag: 'Central Hub',
      type: 'primary',
      title: 'Nairobi Industrial Area Hub',
      description:
        'Our primary 15,000-pallet high-bay facility. Handles container intake, automated barcode wave picking, bonded storage, and intra-Nairobi same-day express dispatches.',
      location: 'Commercial Street, Industrial Area',
    },
    {
      code: 'GATEWAY-MSA',
      tag: 'Inbound Maritime',
      type: 'amber',
      title: 'Mombasa Port & ICD Embakasi',
      description:
        'Dedicated inbound cargo handling for sea freight containers and air freight consignments. Container de-stuffing, transit bonded clearing, and primary haulage to Nairobi.',
      location: 'Kilindini Port & Inland Container Depot',
    },
    {
      code: 'HUB-WEST-01',
      tag: 'Western Distribution',
      type: 'primary',
      title: 'Western & North Rift Hubs',
      description:
        'Regional sorting facilities in Kisumu and Eldoret providing same-day distribution across 14 Western Kenya counties, including Kakamega, Kisii, and Bungoma.',
      location: 'Kisumu City Hub & Eldoret Highway Depot',
    },
    {
      code: 'CORRIDOR-EAC',
      tag: 'Cross-Border',
      type: 'amber',
      title: 'East Africa Cross-Border Network',
      description:
        'Cross-border bonded road freight corridors connecting Kenyan manufacturers and distributors directly to Kampala (Uganda), Arusha (Tanzania), and Kigali (Rwanda).',
      location: 'Malaba, Busia & Namanga Corridors',
    },
  ];

  return (
    <section className="section-pad about-section" id="about">
      <div className="container">
        {/* About Us Story Header */}
        <div className="about-grid">
          <div className="about-text">
            <span className="eyebrow-badge">
              <Building2 size={14} /> ABOUT SHIP IT LOGISTICS
            </span>
            <h3>
              The courier and 3PL distribution backbone built for <span className="text-blue">Kenya &amp; East Africa.</span>
            </h3>
            <p>
              Ship It is a fulfillment operating system for commercial logistics teams. It connects inventory,
              warehouse execution, dispatch, delivery proof, cash reconciliation, and merchant settlement workflows.
            </p>
            <p>
              The product is designed around operational traceability: barcode-supported picks, validated manifest
              handovers, public tracking, delivery exceptions, and auditable financial records.
            </p>

            <div className="about-highlights">
              <div className="about-stat-box">
                <div className="stat-number">ASN → GRN</div>
                <div className="stat-desc">Inbound receiving with recorded quantities</div>
              </div>
              <div className="about-stat-box">
                <div className="stat-number">Pick → Pack</div>
                <div className="stat-desc">Barcode-supported fulfillment workflow</div>
              </div>
              <div className="about-stat-box">
                <div className="stat-number">Manifest → POD</div>
                <div className="stat-desc">Route validation and delivery evidence</div>
              </div>
              <div className="about-stat-box">
                <div className="stat-number">COD → Settlement</div>
                <div className="stat-desc">Reconciliation and approval controls</div>
              </div>
            </div>
          </div>

          {/* Visual Presentation Stack with Fleet Photo */}
          <div className="about-visual-stack">
            <img
              src="/images/courier-handover.jpg"
              alt="Ship It Commercial Fleet and Distribution Hub in Kenya"
              className="about-main-img"
            />
            <div className="about-card-floating">
              <strong>Complete Inbound &amp; Outbound Custody</strong>
              <p>
                From offloading import containers at Mombasa Port to automated M-Pesa STK push confirmation at the
                customer's doorstep in Kisumu or Nairobi.
              </p>
            </div>
          </div>
        </div>

        {/* Strategic Nodes Grid */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
            <span className="eyebrow-badge">
              <MapPin size={14} /> STRATEGIC SUPPLY CHAIN HUBS
            </span>
            <h4 style={{ fontSize: '1.75rem', color: 'var(--navy-deep)' }}>
              Integrated Nodes Connecting Manufacturing to Retail
            </h4>
          </div>

          <div className="nodes-grid">
            {nodes.map((node) => (
              <div className="node-card" key={node.code}>
                <div className="node-header">
                  <span className={`node-tag ${node.type}`}>{node.tag}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {node.code}
                  </span>
                </div>
                <h4>{node.title}</h4>
                <p>{node.description}</p>
                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    color: 'var(--blue-brand)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <MapPin size={13} /> {node.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
