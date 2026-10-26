# Engineering Follow-up Guide

Use this directory as the maintained entry point for product and production follow-up.

- [Functional audit](FUNCTIONAL-AUDIT.md): which user-facing controls are wired, which are placeholders, and the gaps that block reliable operation.
- [Production roadmap](PRODUCTION-ROADMAP.md): ordered delivery gates, owners, and evidence required before a live pilot.
- [Render deployment](RENDER-DEPLOYMENT.md): deploy the API, worker, four web apps, PostgreSQL, and Redis from the Render Blueprint.

## Local quality gate

Run `npm run check` before opening a pull request. It runs workspace type checks, API tests, and every production build. The write-enabled acceptance journey is deliberately not part of this command because it requires a disposable API, Redis, PostgreSQL database, and explicitly confirmed data writes; see `MASTER.md` section 10.1.

## Codebase boundaries

| Directory | Responsibility |
| --- | --- |
| `apps/website` | Public marketing, commercial inquiry, and public tracking surfaces |
| `apps/merchant-portal` | Merchant inventory, orders, labels, inbound, ledger, and settlement requests |
| `apps/staff-portal` | Permission-aware warehouse, dispatch, finance, returns, and provisioning operations |
| `apps/rider-pwa` | Rider task execution, barcode verification, POD, and offline outbox |
| `services/api` | Express REST API, authorization, operational domain workflows, and public endpoints |
| `packages/*` | Shared API client, types, validation, and database schema/client |
| `docker` | Development and production container definitions plus the gateway |
