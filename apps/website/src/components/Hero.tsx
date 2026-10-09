import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface HeroProps {
  onOpenLeadModal: () => void;
}

export function Hero({ onOpenLeadModal }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={14} /> East Africa's Physical Commerce Operating System
          </div>
          <h1>
            Not just a courier. <br />
            A complete <span className="gradient-text">Fulfillment OS.</span>
          </h1>
          <p>
            Ship It bridges merchant inbound storage, pre-dispatch fraud verification, thermal
            waybills, and same-day delivery with instant Safaricom M-Pesa Cash-on-Delivery (COD)
            clearing and zero-variance ledger reconciliation.
          </p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={onOpenLeadModal}>
              Start Fulfilling Orders <ArrowRight size={16} />
            </button>
            <a href="#pricing" className="btn btn-secondary">
              Calculate Your Pricing
            </a>
            <a href="#tracking" className="btn btn-secondary">
              Track a Waybill
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
