import React, { useState } from 'react';
import { api } from '@shipit/api-client';
import { CheckCircle2, Clock, Package, Search } from 'lucide-react';

interface TrackingTimelineItem {
  status: string;
  occurredAt: string;
  detail?: string;
}

interface TrackingResult {
  trackingNumber: string;
  orderNumber: string;
  status: string;
  destination: {
    county: string;
    townOrSubCounty: string;
  };
  timeline: TrackingTimelineItem[];
}

export function TrackingWidget() {
  const [waybill, setWaybill] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');

  async function handleTrack(event: React.FormEvent) {
    event.preventDefault();
    const query = waybill.trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await api.publicRequest<TrackingResult>(`/tracking/${encodeURIComponent(query)}`);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not find a parcel with that waybill number. Please check and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" id="tracking">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">
            <Package size={14} /> Live Milestone Tracking
          </div>
          <h2>
            Track any parcel <span className="gradient-text">in real time.</span>
          </h2>
          <p>
            Enter your 4x6 thermal waybill tracking code to inspect real-time dispatch and delivery
            status.
          </p>
        </div>

        <div className="track-widget-box">
          <form onSubmit={handleTrack}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Waybill Number
            </label>
            <div className="track-form-row">
              <input
                value={waybill}
                onChange={(event) => setWaybill(event.target.value)}
                placeholder="e.g. WB-2026-90412-KE"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Search size={16} /> {loading ? 'Locating…' : 'Track Parcel'}
              </button>
            </div>
          </form>

          {error && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.92rem',
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div className="track-timeline">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.75rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Tracking Code
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    {result.trackingNumber}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Destination Area
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                    {result.destination.townOrSubCounty}, {result.destination.county}
                  </div>
                </div>
                <div
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {result.status.replaceAll('_', ' ')}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {result.timeline.map((event, index) => (
                  <div
                    key={`${event.status}-${index}`}
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background:
                          index === 0
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border:
                          index === 0
                            ? '1px solid #10b981'
                            : '1px solid var(--border-subtle)',
                        color: index === 0 ? '#10b981' : 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index === 0 ? <CheckCircle2 size={16} /> : <Clock size={14} />}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>
                        {event.status.replaceAll('_', ' ')}
                      </strong>
                      {event.detail && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {event.detail}
                        </p>
                      )}
                      <time style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                        {new Date(event.occurredAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
