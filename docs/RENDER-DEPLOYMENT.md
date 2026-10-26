# Render deployment

The root [`render.yaml`](../render.yaml) Blueprint describes the production Docker images and managed PostgreSQL and Render Key Value services. Render Key Value currently runs Valkey, which is compatible with the app's Redis client and BullMQ. The Blueprint deploys:

- `web`: public website and the staff, merchant, and rider apps under `/staff/`, `/merchant/`, and `/rider/`
- `api`: Express API, including payment callback endpoints
- `worker`: BullMQ background worker
- `shipit-db` and `redis`: managed data services

## Create the Render environment

1. Push this repository to GitHub.
2. In Render, choose **New + → Blueprint**, connect the repository, and select the branch to deploy.
3. Review the Blueprint resource plans and region before applying it. The configured starter services and PostgreSQL plan are paid resources; do not apply the Blueprint until the displayed costs and data-retention terms are acceptable.
4. Keep all resources in the same region. The Blueprint currently selects Singapore; change every `region` entry together if another supported region is preferred.
5. Set a unique `SHIPIT_ADMIN_EMAIL`, a strong `SHIPIT_ADMIN_PASSWORD` (at least 16 characters), and `SHIPIT_ADMIN_PHONE` in the `api` service's environment before bootstrapping.
6. After the first successful deploy, open the `api` service shell and run `npm run db:bootstrap:production --workspace=@shipit/database`. This creates the first administrator and operational baseline without demo merchants, riders, or orders. It will not promote an existing non-admin account or change an existing admin's password. Do not run the general `db:seed` script against live production data.
7. Leave `MPESA_ENV` as `sandbox` until the Daraja integration has passed the production-readiness checks. Add real payment, messaging, and webhook secrets in Render's environment settings, not in Git.
8. Visit the `web` service URL and verify `/`, `/staff/`, `/merchant/`, `/rider/`, and `/api/health/ready`. Configure a custom domain only after those checks pass.

The API's pre-deploy command applies committed Prisma migrations before each API deployment. The worker uses the same managed database and Redis connection strings. Keep database backups enabled and test a restore before a live pilot.

## Operational limits to address before a live pilot

- The API is public for external payment callbacks. Configure callback URLs and tokens only after assigning the final API URL, and review the callback allowlisting and monitoring requirements with the payment provider.
- The rider PWA's proof-of-delivery data is currently handled by the application; this Blueprint does not provision object storage.
- Starter compute and the configured PostgreSQL tier are a starting point, not a capacity or availability guarantee. Validate expected throughput, database storage, backups, and recovery targets before production use.
