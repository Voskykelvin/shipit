# Functional UI Audit

Audited: 18 October 2026. This is a code-path audit, not proof of a live deployment or payment-provider integration.

## Confirmed functional controls

| Surface | Controls checked | Result |
| --- | --- | --- |
| Public website | Service tabs, calculator inputs, FAQ, tracking lookup, quote form | State changes work; tracking calls `GET /api/tracking/:trackingNumber`; inquiries call validated `POST /api/inquiries`. |
| Merchant portal | Login, order creation/import, label download, ASN creation, settlement request, public tracking | Connected through `@shipit/api-client` to authenticated API routes. |
| Staff portal | Merchant/product/rider setup, inventory adjustment, ASN receive, pick/pack, manifest scan/handover, returns, finance | Permission-gated controls invoke API handlers from the portal container. |
| Rider PWA | Sign-in, stop selection, barcode check, M-Pesa prompt/status, POD, NDR, offline outbox sync | Connected to API; payment-backed POD is gated on confirmed STK status. |

Form buttons without an explicit `onClick` were checked as submit buttons attached to forms; they are not inert cosmetic controls.

## Findings to remove or correct before public launch

1. **Do not publish placeholder contact information.** The marketing header/footer still show `+254 (0) 700 000 000` and `enterprise@shipit.co.ke`. Replace with owned, monitored support channels or remove them. The brand link `href="#"` should point to `/`.
2. **Do not advertise unverified operational claims.** Coverage, fleet, insurance, response-time, licensing, and SLA content must be fed from approved commercial data or stated as proposal-dependent. The calculator is already labelled an estimate; use the same standard elsewhere.
3. **Make inquiries durable.** `POST /api/inquiries` currently emits a BullMQ event. `enqueueDomainEvent` intentionally swallows Redis failures, so an inquiry can receive a 201 response without durable storage or notification. Add an `inquiries` database table plus an outbox record in the same transaction, then deliver email/CRM notifications from the worker.
4. **Remove duplicate public tracking implementations.** The website `/track` page and merchant portal `/track` page independently render public tracking. Extract a shared public tracking feature or keep the website route as the canonical recipient link and redirect the merchant route.
5. **Add browser-level tests.** Current tests are API/unit oriented. Add Playwright coverage for quote validation, a successful/unknown tracking number, login authorization, an order-to-waybill flow, and rider offline outbox retry.

## Not a placeholder, but needs operational evidence

- The event worker currently logs events when no webhook endpoint is configured; it does not itself email an operator or create a CRM lead.
- Production Compose provides containers and a reverse proxy, but TLS termination, DNS, secret rotation, monitoring, retention, and alert ownership are external deployment responsibilities.
- The live acceptance test intentionally writes data and requires a disposable environment. It is correctly excluded from ordinary CI.
