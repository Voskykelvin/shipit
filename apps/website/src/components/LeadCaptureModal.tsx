import React, { useState } from 'react';
import { CheckCircle2, MessageSquare, Send, X } from 'lucide-react';

interface LeadCaptureModalProps {
  isOpen: boolean;
  initialOrders?: number;
  onClose: () => void;
}

export function LeadCaptureModal({ isOpen, initialOrders = 350, onClose }: LeadCaptureModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Cosmetics & Skincare');
  const [orders, setOrders] = useState(initialOrders);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Simulate/Post inquiry
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          contactName,
          phone,
          email,
          category,
          estimatedMonthlyOrders: orders,
        }),
      }).catch(() => {
        // Fallback gracefully if API endpoint is not yet connected
      });
    } catch {
      // Ignore
    }
    setSubmitted(true);
  }

  const waMessage = encodeURIComponent(
    `Hello Ship It team, I'd like to onboard my brand "${businessName}" (${category}) for fulfillment. We ship approximately ${orders} orders per month.`,
  );
  const waUrl = `https://wa.me/254712000111?text=${waMessage}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        {!submitted ? (
          <>
            <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>
              Merchant Onboarding
            </div>
            <h2>Scale Your Physical Commerce</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              Submit your business details to receive a customized fulfillment rate card and warehouse onboarding slot.
            </p>

            <form className="lead-form" onSubmit={handleSubmit}>
              <label>
                Business / Brand Name
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Nairobi Glow Organics"
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label>
                  Contact Person
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your Name"
                    required
                  />
                </label>
                <label>
                  WhatsApp / Phone
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    required
                  />
                </label>
              </div>

              <label>
                Business Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@brand.ke"
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <label>
                  Product Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="Cosmetics & Skincare">Cosmetics & Skincare</option>
                    <option value="Electronics & Accessories">Electronics & Gadgets</option>
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Health & Supplements">Health & Wellness</option>
                    <option value="Home & Consumer Goods">Home & Consumer Goods</option>
                  </select>
                </label>
                <label>
                  Monthly Orders
                  <input
                    type="number"
                    min="10"
                    value={orders}
                    onChange={(e) => setOrders(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <Send size={16} /> Request Rate Card & Hub Tour
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2>Inquiry Received!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0.75rem auto 1.75rem', maxWidth: '380px' }}>
              Thank you, <strong>{contactName}</strong>. Our fulfillment onboarding specialist will contact you within 2 hours.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-emerald"
                style={{ width: '100%' }}
              >
                <MessageSquare size={16} /> Chat Instantly on WhatsApp
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
