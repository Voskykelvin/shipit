import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';

interface NavbarProps {
  onOpenLeadModal: () => void;
}

export function Navbar({ onOpenLeadModal }: NavbarProps) {
  return (
    <>
      {/* Top Corporate Status Ticker */}
      <div className="top-ticker-bar">
        <div className="container top-ticker-inner">
          <div className="ticker-left">
            <span className="ticker-badge">KENYA &amp; REGIONAL 3PL</span>
            <span className="ticker-text">
              Nairobi Industrial Area Hub &amp; ICD Embakasi • Serving 47 Counties • Next-Morning COD Remittance
            </span>
          </div>

          <div className="ticker-right">
            <a
              href="https://app.shipit.co.ke"
              target="_blank"
              rel="noreferrer"
              className="ticker-link"
              title="Staff Operations Control Tower"
            >
              Control Tower <ExternalLink size={12} />
            </a>
            <a
              href="https://rider.shipit.co.ke"
              target="_blank"
              rel="noreferrer"
              className="ticker-link"
              title="Courier Rider PWA"
            >
              Rider App <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Corporate Navigation */}
      <header className="navbar">
        <div className="container nav-inner">
          <a href="/" className="brand-link">
            <div className="brand-logo-badge">S</div>
            <div className="brand-title-wrap">
              <strong>Ship It Logistics</strong>
              <span>Courier &amp; Warehousing KE</span>
            </div>
          </a>

          <ul className="nav-menu">
            <li>
              <a href="#about">About Us</a>
            </li>
            <li>
              <a href="#services">Services</a>
            </li>
            <li>
              <a href="#solutions">For Manufacturers</a>
            </li>
            <li>
              <a href="#calculator">Tariff Calculator</a>
            </li>
            <li>
              <a href="#coverage">47 Counties</a>
            </li>
            <li>
            <a href="/track">Track Consignment</a>
            </li>
          </ul>

          <div className="nav-actions">
            <a
              href="https://merchant.shipit.co.ke"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              title="Merchant Portal Login"
            >
              Merchant Portal <ExternalLink size={14} />
            </a>
            <button className="btn btn-amber" onClick={onOpenLeadModal}>
              Request Corporate Quote <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
