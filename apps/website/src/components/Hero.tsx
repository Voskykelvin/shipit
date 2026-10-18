import React from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  MapPin,
  ShieldCheck,
  Truck,
  Warehouse,
} from 'lucide-react';

interface HeroProps {
  onOpenLeadModal: () => void;
}

export function Hero({ onOpenLeadModal }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-grid">
          {/* Left Column: Authoritative Logistics Value Proposition */}
          <div className="hero-copy-col">
            <div className="hero-badge-strip">
              <ShieldCheck size={15} />
              <span>FULFILLMENT OPERATING SYSTEM FOR KENYAN COMMERCE</span>
            </div>

            <h1 className="hero-title">
              Precision Warehousing, <br />
              <span className="highlight-amber">Countrywide Courier</span> &amp; <br />
              <span className="highlight-blue">Fleet Distribution.</span>
            </h1>

            <p className="hero-lead">
              Purpose-built for merchants, distributors, and operators who need one system for inbound stock,
              warehouse execution, dispatch, delivery proof, and COD reconciliation. Start with the services you
              need and configure a delivery network around your operation.
            </p>

            {/* Core Capability Pillars */}
            <div className="hero-pillars-row">
              <div className="hero-pillar-card">
                <Warehouse size={20} className="pillar-icon" />
                <span className="pillar-title">High-Bay Storage</span>
                <span className="pillar-sub">Barcode-addressed inventory and receiving</span>
              </div>

              <div className="hero-pillar-card">
                <Coins size={20} className="pillar-icon" />
                <span className="pillar-title">Pay On Delivery</span>
                <span className="pillar-sub">Callback-confirmed M-Pesa collection workflow</span>
              </div>

              <div className="hero-pillar-card">
                <Truck size={20} className="pillar-icon" />
                <span className="pillar-title">Dedicated Fleet</span>
                <span className="pillar-sub">Manifest handover and delivery proof</span>
              </div>
            </div>

            {/* Action Group */}
            <div className="hero-cta-group">
              <button className="btn btn-amber btn-lg" onClick={onOpenLeadModal}>
                Request Corporate Quote <ArrowRight size={17} />
              </button>
              <a href="#calculator" className="btn btn-secondary btn-lg">
                View Logistics Tariffs
              </a>
              <a href="/track" className="btn btn-secondary btn-lg">
                Track Consignment
              </a>
            </div>
          </div>

          {/* Right Column: Hero High-Bay Warehouse Showcase (Using User's Uploaded Facility Photo) */}
          <div className="hero-visual-card">
            <img
              src="/images/warehouse-highbay.png"
              alt="Ship It High-Bay Pallet Racking Logistics Center in Nairobi"
              className="hero-main-photo"
            />
            <div className="hero-photo-overlay" />

            {/* Floating Live Metric Chips */}
            <div className="hero-floating-chip chip-top-left">
              <div className="chip-icon amber">
                <Boxes size={20} />
              </div>
              <div className="chip-text">
                <strong>Inventory you can account for</strong>
                <span>Receiving, bin locations, pick waves, and audit history</span>
              </div>
            </div>

            <div className="hero-floating-chip chip-bottom-left">
              <div className="chip-icon emerald">
                <Coins size={20} />
              </div>
              <div className="chip-text">
                <strong>M-Pesa verified COD</strong>
                <span>STK confirmation before payment-backed delivery completion</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
