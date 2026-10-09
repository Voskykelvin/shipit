import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@shipit/api-client';
import { Package, Search } from 'lucide-react';
import type { TrackingInfo } from '../../types';
import { Status } from '../../components/ui';

export function PublicTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState(() =>
    new URLSearchParams(window.location.search).get('waybill')?.trim() ?? '',
  );
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latestLookup = useRef(0);

  const lookup = useCallback(async (number: string) => {
    const lookupId = ++latestLookup.current;
    setBusy(true);
    setError('');
    setTracking(null);
    try {
      const result = await api.publicRequest<TrackingInfo>(`/tracking/${encodeURIComponent(number)}`);
      if (lookupId === latestLookup.current) setTracking(result);
    } catch (cause) {
      if (lookupId === latestLookup.current) {
        setError(cause instanceof Error ? cause.message : 'Tracking lookup failed.');
      }
    } finally {
      if (lookupId === latestLookup.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initialWaybill = new URLSearchParams(window.location.search).get('waybill')?.trim();
    if (initialWaybill) void lookup(initialWaybill);
  }, [lookup]);

  return (
    <main className="public-tracking">
      <header className="public-tracking-brand">
        <a className="tracking-brand-mark" href="/" aria-label="Ship It merchant portal">
          S
        </a>
        <div>
          <strong>Ship It</strong>
          <span>Parcel tracking</span>
        </div>
        <a className="tracking-merchant-link" href="/">
          Merchant sign in
        </a>
      </header>
      <section className="public-tracking-content">
        <div className="tracking-intro">
          <span className="tracking-eyebrow">SHIP IT DELIVERY</span>
          <h1>Your parcel, in view.</h1>
          <p>Enter the waybill number to see the latest delivery progress.</p>
        </div>
        <form
          className="tracking-search-card"
          onSubmit={(event) => {
            event.preventDefault();
            const number = trackingNumber.trim();
            if (number) void lookup(number);
          }}
        >
          <label htmlFor="public-waybill">Waybill number</label>
          <div className="tracking-search-row">
            <input
              id="public-waybill"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="WB-2026-…"
              autoComplete="off"
              required
            />
            <button type="submit" disabled={busy || !trackingNumber.trim()}>
              <Search size={16} /> {busy ? 'Checking…' : 'Track parcel'}
            </button>
          </div>
          {error && (
            <p className="tracking-error" role="alert">
              {error}
            </p>
          )}
        </form>
        {tracking && (
          <section className="tracking-result public-tracking-result" aria-live="polite">
            <div className="tracking-result-heading">
              <div className="tracking-parcel-icon">
                <Package size={21} />
              </div>
              <div>
                <span>WAYBILL</span>
                <strong>{tracking.trackingNumber}</strong>
              </div>
              <Status value={tracking.status} />
            </div>
            <div className="public-destination">
              <span>Delivering to</span>
              <strong>
                {tracking.destination.townOrSubCounty}, {tracking.destination.county}
              </strong>
            </div>
            <ol className="timeline">
              {tracking.timeline.map((item, index) => (
                <li key={`${item.status}-${item.occurredAt}-${index}`}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.status.replaceAll('_', ' ')}</strong>
                    {item.detail && <p>{item.detail}</p>}
                    <time>{new Date(item.occurredAt).toLocaleString()}</time>
                  </div>
                </li>
              ))}
            </ol>
            <p className="tracking-privacy">
              Tracking shows delivery milestones and destination area only. For help, contact your seller.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
