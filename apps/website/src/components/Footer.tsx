import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="logo-badge">S</div>
              <strong style={{ fontSize: '1.25rem' }}>Ship It</strong>
            </div>
            <p>
              The physical goods Fulfillment Operating System for emerging e-commerce markets.
              End-to-end custody tracking, warehousing, pre-dispatch verification, and Safaricom
              M-Pesa Cash-on-Delivery clearing.
            </p>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#features">Architecture</a>
              </li>
              <li>
                <a href="#pricing">Rate Calculator</a>
              </li>
              <li>
                <a href="#coverage">Coverage Map</a>
              </li>
              <li>
                <a href="#tracking">Milestone Tracking</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Portals</h4>
            <ul>
              <li>
                <a href="http://localhost:3001" target="_blank" rel="noreferrer">
                  Merchant Portal <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="http://localhost:3000" target="_blank" rel="noreferrer">
                  Staff FOS Dashboard <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="http://localhost:3002" target="_blank" rel="noreferrer">
                  Rider Delivery PWA <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="#tracking">Parcel Tracking</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Security & Standards</h4>
            <ul>
              <li>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                  <ShieldCheck size={16} /> Zero Untracked Movements
                </span>
              </li>
              <li>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Append-Only Ledgers
                </span>
              </li>
              <li>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Safaricom Daraja STK Push
                </span>
              </li>
              <li>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Nairobi Hubs · Kenya
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} Ship It Technologies Ltd. All rights reserved. Registered in Kenya.
          </div>
          <div>
            Master Fulfillment Operating System · Version 1.0 Production Blueprint
          </div>
        </div>
      </div>
    </footer>
  );
}
