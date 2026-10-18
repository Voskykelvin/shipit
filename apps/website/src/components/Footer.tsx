import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="corporate-footer">
      <div className="container">
        <div className="footer-top-grid">
          {/* Brand Column */}
          <div className="footer-brand-pane">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div className="brand-logo-badge" style={{ width: '38px', height: '38px', fontSize: '1.25rem' }}>
                S
              </div>
              <strong style={{ fontSize: '1.35rem', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                Ship It Logistics
              </strong>
            </div>
            <p>
              A fulfillment operating system for teams that need inventory control, warehouse execution, delivery
              evidence, and COD reconciliation in one operational workflow.
            </p>

            <div style={{ marginTop: '1.5rem' }}>
              <a href="/request-quote" className="btn btn-amber">Request a proposal</a>
            </div>
          </div>

          {/* Capabilities Column */}
          <div>
            <h4 className="footer-col-title">Capabilities</h4>
            <ul className="footer-nav-list">
              <li>
                <a href="#services">High-Bay Pallet Storage</a>
              </li>
              <li>
                <a href="#services">Countrywide Express Courier</a>
              </li>
              <li>
                <a href="#services">Pay on Delivery (COD &amp; M-Pesa)</a>
              </li>
              <li>
                <a href="#services">Dedicated Rider &amp; Fleet Hire</a>
              </li>
              <li>
                <a href="#services">Mombasa Port &amp; ICD Cargo</a>
              </li>
              <li>
                <a href="#services">Cross-Border East Africa</a>
              </li>
            </ul>
          </div>

          {/* Sector Solutions */}
          <div>
            <h4 className="footer-col-title">Sector Solutions</h4>
            <ul className="footer-nav-list">
              <li>
                <a href="#solutions">FMCG &amp; Food Manufacturers</a>
              </li>
              <li>
                <a href="#solutions">Pharmaceuticals &amp; Health</a>
              </li>
              <li>
                <a href="#solutions">Hardware &amp; Heavy Importers</a>
              </li>
              <li>
                <a href="#solutions">eCommerce &amp; Retail Brands</a>
              </li>
              <li>
                <a href="#calculator">Tariff Rate Calculator</a>
              </li>
              <li>
                <a href="#coverage">47 Counties Network Map</a>
              </li>
            </ul>
          </div>

          {/* Operational Portals & Compliance */}
          <div>
            <h4 className="footer-col-title">Operational Portals</h4>
            <ul className="footer-nav-list">
              <li>
                <a href="https://merchant.shipit.co.ke" target="_blank" rel="noreferrer">
                  Merchant Stock Portal <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://app.shipit.co.ke" target="_blank" rel="noreferrer">
                  Staff Control Tower <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://rider.shipit.co.ke" target="_blank" rel="noreferrer">
                  Rider Operations App <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="/track">Consignment Waybill Tracker</a>
              </li>
            </ul>

            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
                <ShieldCheck size={16} /> Fully Insured &amp; Licensed
              </div>
              <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.35rem', lineHeight: 1.5 }}>
                Communications Authority Licensed Courier Operator. KES 50,000,000 Goods In Transit coverage.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div>
            &copy; {new Date().getFullYear()} Ship It Logistics &amp; Courier Services Kenya Ltd. All rights reserved.
          </div>
          <div>
            Nairobi · Mombasa · Kisumu · Eldoret · Nakuru · East African Corridors
          </div>
        </div>
      </div>
    </footer>
  );
}
