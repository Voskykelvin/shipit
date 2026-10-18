import React, { useEffect, useState } from 'react';
import { api } from '@shipit/api-client';
import { CheckCircle2, MapPin, Package, Search, Truck } from 'lucide-react';
import { trackMarketingEvent } from '../utils/analytics';

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

interface TrackingWidgetProps {
  initialTrackingNumber?: string;
}

export function TrackingWidget({ initialTrackingNumber = '' }: TrackingWidgetProps) {
  const [waybill, setWaybill] = useState(initialTrackingNumber);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');

  async function handleTrack(event?: React.FormEvent, codeToTrack?: string) {
    if (event) event.preventDefault();
    const query = (codeToTrack || waybill).trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      trackMarketingEvent('tracking_searched');
      const data = await api.publicRequest<TrackingResult>(`/tracking/${encodeURIComponent(query)}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that waybill. Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialTrackingNumber) void handleTrack(undefined, initialTrackingNumber);
  // The initial URL value is intentionally read once when this page mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="section-pad tracking-section" id="tracking">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow-badge">
            <Package size={14} /> REAL-TIME WAYBILL TRACKING
          </span>
          <h2 className="section-title">
            Track Your Consignment <span className="text-blue">in Real Time.</span>
          </h2>
          <p className="section-sub">
            Inspect live chain-of-custody milestones, route dispatch manifests, and delivery confirmation
            with thermal barcode waybill verification.
          </p>
        </div>

        <div className="tracking-card-container">
          <form onSubmit={(e) => handleTrack(e)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--navy-deep)' }}>
                Waybill / Consignment Tracking Number
              </label>
            </div>

            <div className="tracking-input-bar">
              <input
                value={waybill}
                onChange={(e) => setWaybill(e.target.value)}
                placeholder="e.g. WB-84920-KE or CNT-2026-NBO"
                required
              />
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                <Search size={18} /> {loading ? 'Locating...' : 'Track Consignment'}
              </button>
            </div>
          </form>

          {error && <p role="alert" style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>}

          {/* Tracking Result View */}
          {result && (
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)' }}>
              {/* Header Info Banner */}
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Waybill Number
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--navy-deep)' }}>
                    {result.trackingNumber}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Destination Area
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-deep)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={15} color="#1d4ed8" /> {result.destination.townOrSubCounty}, {result.destination.county}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--blue-light)',
                    color: 'var(--blue-brand)',
                    border: '1px solid #bfdbfe',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                  }}
                >
                  {result.status.replaceAll('_', ' ')}
                </div>
              </div>

              {/* Milestone Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '0.5rem' }}>
                {result.timeline.map((event, index) => (
                  <div
                    key={`${event.status}-${index}`}
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      alignItems: 'flex-start',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: index === 0 ? 'var(--blue-brand)' : '#ffffff',
                        border: index === 0 ? '2px solid #ffffff' : '2px solid var(--border-strong)',
                        color: index === 0 ? '#ffffff' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: index === 0 ? '0 0 12px rgba(29, 78, 216, 0.4)' : 'none',
                        zIndex: 2,
                      }}
                    >
                      {index === 0 ? <Truck size={18} /> : <CheckCircle2 size={16} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1.02rem', color: 'var(--navy-deep)' }}>
                          {event.status.replaceAll('_', ' ')}
                        </strong>
                        <time style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                          {new Date(event.occurredAt).toLocaleString()}
                        </time>
                      </div>
                      {event.detail && (
                        <p style={{ color: 'var(--text-body)', fontSize: '0.88rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                          {event.detail}
                        </p>
                      )}
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
