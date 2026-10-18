import React, { useState } from 'react';
import { api } from '@shipit/api-client';
import { CheckCircle2, Send, X } from 'lucide-react';
import { trackMarketingEvent } from '../utils/analytics';

interface LeadCaptureModalProps {
  isOpen: boolean;
  initialOrders?: number;
  onClose: () => void;
  standalone?: boolean;
}

export function LeadCaptureModal({ isOpen, initialOrders = 500, onClose, standalone = false }: LeadCaptureModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessType, setBusinessType] = useState('Distributor / Wholesaler');
  const [pallets, setPallets] = useState(10);
  const [orders, setOrders] = useState(initialOrders);
  const [serviceNeeded, setServiceNeeded] = useState('Storage + Courier + Pay on Delivery');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.publicRequest<{ success: boolean }>('/inquiries', {
        method: 'POST',
        body: {
          businessName,
          contactName,
          phone,
          email,
          businessType,
          pallets,
          estimatedMonthlyOrders: orders,
          serviceNeeded,
        },
      });
      trackMarketingEvent('quote_submitted');
      setSubmitted(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={standalone ? 'quote-page-shell' : 'modal-backdrop'} onClick={standalone ? undefined : onClose}>
      <div className={standalone ? 'modal-sheet quote-page-form' : 'modal-sheet'} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        {!submitted ? (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="eyebrow-badge">CORPORATE 3PL &amp; COURIER RFQ</span>
              <h2 style={{ fontSize: '1.85rem', color: 'var(--navy-deep)', marginTop: '0.5rem', lineHeight: 1.2 }}>
                Request Corporate Proposal &amp; Hub Tour
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.35rem' }}>
                Tell us what you need and we will follow up with a tailored scope, availability, and onboarding plan.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}
            >
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                  Company / Organization Name
                </label>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Consumer Distributors Ltd"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border-strong)',
                    fontSize: '0.95rem',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                    Contact Person
                  </label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your Full Name"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border-strong)',
                      fontSize: '0.95rem',
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 712 000 000"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border-strong)',
                      fontSize: '0.95rem',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="logistics@company.co.ke"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border-strong)',
                    fontSize: '0.95rem',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                    Enterprise Profile
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border-strong)',
                      fontSize: '0.95rem',
                      background: '#fff',
                    }}
                  >
                    <option value="Manufacturer (Local/MNC)">Manufacturer (Local / MNC)</option>
                    <option value="Distributor / Wholesaler">Distributor / Wholesaler</option>
                    <option value="International Importer">International Importer</option>
                    <option value="eCommerce / Retail Brand">eCommerce / Retail Brand</option>
                    <option value="Pharmaceuticals">Pharmaceuticals &amp; Healthcare</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                    Pallet Space Needed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pallets}
                    onChange={(e) => setPallets(Number(e.target.value))}
                    placeholder="Pallet Bays"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--border-strong)',
                      fontSize: '0.95rem',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'block', marginBottom: '0.35rem' }}>
                  Core Logistics Requirement
                </label>
                <select
                  value={serviceNeeded}
                  onChange={(e) => setServiceNeeded(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border-strong)',
                    fontSize: '0.95rem',
                    background: '#fff',
                  }}
                >
                  <option value="Storage + Courier + Pay on Delivery">Full Package (Warehousing, Courier &amp; COD)</option>
                  <option value="Contract Warehousing & Pallet Storage Only">Contract Pallet Storage &amp; Warehousing Only</option>
                  <option value="Countrywide Courier Distribution Only">Nationwide Courier &amp; Last-Mile Express Only</option>
                  <option value="Dedicated Fleet & Rider Outsourcing">Dedicated Rider &amp; Box Truck Fleet Hire</option>
                  <option value="Inbound Port Cargo Clearance & Cross-Docking">Mombasa Port Cargo &amp; Cross-Border Freight</option>
                </select>
              </div>

              {error && <p role="alert" style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{error}</p>}
              <button
                type="submit"
                className="btn btn-amber btn-lg"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={submitting}
              >
                <Send size={16} /> {submitting ? 'Sending request...' : 'Submit Proposal Request'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(5, 150, 105, 0.15)',
                color: 'var(--emerald-mpesa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '1.85rem', color: 'var(--navy-deep)' }}>Proposal Request Received!</h2>
            <p style={{ color: 'var(--text-body)', fontSize: '0.98rem', margin: '0.75rem auto 1.75rem', maxWidth: '420px', lineHeight: 1.6 }}>
              Thank you, <strong>{contactName}</strong>. We have received {businessName}'s requirements and will
              use the contact details you provided to follow up.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ width: '100%', color: 'var(--navy-deep)', borderColor: 'var(--border-strong)' }}
              >
                Return to website
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
