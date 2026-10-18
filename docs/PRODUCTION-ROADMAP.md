# Roadmap to a Production Pilot

The current pilot decision remains **no-go** until the gates below have evidence. Complete each phase in order; a green compile is not a release decision.

## Phase 0 — Make public operations truthful (1 sprint)

- Replace placeholder contact data and point the logo to `/`.
- Create durable commercial inquiries and an outbox-backed notification/CRM delivery path.
- Approve every public operational claim, or make it proposal-dependent.
- Choose one canonical public tracking route and update merchant-generated links.

**Exit evidence:** a submitted inquiry survives Redis outage/restart and is visible to an operations owner; unknown tracking numbers show a user-safe error; all public contact paths reach a monitored channel.

## Phase 1 — Quality and release controls (1–2 sprints)

- Add Playwright end-to-end tests for public, merchant, staff, and rider critical paths.
- Run the existing acceptance journey against disposable PostgreSQL/Redis in CI or a gated staging job.
- Add dependency/security scanning, secret scanning, and image vulnerability scanning to GitHub Actions.
- Require protected-branch reviews, passing `npm run check`, and passing production image builds.

**Exit evidence:** CI produces versioned web/API/worker images, automated tests cover the critical flows, and no high-severity unresolved scan findings remain.

## Phase 2 — Production foundation (1–2 sprints)

- Select hosting, DNS, managed PostgreSQL, managed Redis, object storage, and a secret manager.
- Terminate TLS, redirect HTTP to HTTPS, restrict database/Redis to private networks, and configure least-privilege service identities.
- Configure encrypted backups/PITR, retention, and a scheduled isolated restore drill.
- Define deployment rollback, migration sequencing, environment promotion, and release ownership.

**Exit evidence:** a staging environment mirrors production topology; migration and rollback are rehearsed; backup restore meets agreed RPO/RTO.

## Phase 3 — Observability and payment readiness (1–2 sprints)

- Instrument structured logs, readiness, worker queue depth/age, API error rate, and public inquiry delivery failures.
- Create alerts with owner, severity, contact, and tested runbook action.
- Complete Safaricom sandbox STK, C2B, B2C success/failure/timeout/retry testing using disposable accounts and callback URLs.
- Verify SMS/WhatsApp providers only after approved sender identities and opt-in rules are in place.

**Exit evidence:** an on-call simulation identifies and resolves API, queue, payment callback, and payout failures; provider sandbox evidence is attached to the release record.

## Phase 4 — Controlled pilot (2–4 weeks)

- Onboard 2–3 approved merchants with written service terms and named support contacts.
- Run the full inbound-to-settlement acceptance flow on production-like infrastructure.
- Perform managed-device rider tests: camera permissions, offline capture, reconnect, duplicate retries, mismatched waybill, and STK rejection paths.
- Review daily reconciliation, delivery exceptions, and inquiry/SLA metrics before expanding volume.

**Exit evidence:** no unresolved reconciliation variance, proven restoration, successful payment callback flows, and signed operational go/no-go approval.
