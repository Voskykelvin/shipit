type MarketingEvent =
  | 'quote_opened'
  | 'quote_submitted'
  | 'tracking_searched'
  | 'calculator_quote_requested';

/**
 * Emits aggregate-friendly browser events without storing contact details or
 * introducing a third-party tracking dependency. A consented analytics
 * integration can subscribe to these events at deployment time.
 */
export function trackMarketingEvent(name: MarketingEvent): void {
  window.dispatchEvent(new CustomEvent('shipit:marketing', { detail: { name } }));
}
