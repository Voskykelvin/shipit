import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';

interface NavbarProps {
  onOpenLeadModal: () => void;
}

export function Navbar({ onOpenLeadModal }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <a href="#" className="brand-link">
          <div className="logo-badge">S</div>
          <div className="brand-copy">
            <strong>Ship It</strong>
            <span>Fulfillment OS</span>
          </div>
        </a>

        <ul className="nav-menu">
          <li>
            <a href="#how-it-works">How It Works</a>
          </li>
          <li>
            <a href="#features">Architecture</a>
          </li>
          <li>
            <a href="#pricing">Calculator</a>
          </li>
          <li>
            <a href="#coverage">Coverage</a>
          </li>
          <li>
            <a href="#tracking">Track Parcel</a>
          </li>
        </ul>

        <div className="nav-actions">
          <a
            href="http://localhost:3001"
            className="btn btn-secondary"
            title="Merchant Portal Login"
          >
            Merchant Sign In <ExternalLink size={14} />
          </a>
          <button className="btn btn-primary" onClick={onOpenLeadModal}>
            Get Started <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
