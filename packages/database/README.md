# Ship It Database

## Full local stack

Docker Compose runs PostgreSQL, Redis, Mailpit, MinIO, the API, worker, and all four web apps. From the repository root:

```powershell
Copy-Item .env.example .env
notepad .env
docker compose -f docker/compose.yml up --build -d
docker compose -f docker/compose.yml ps
```

In `.env`, replace `SHIPIT_ADMIN_PASSWORD` with a unique password of at least 16 characters before seeding. The API applies checked-in migrations on startup and readiness checks both PostgreSQL and Redis. Once the API is healthy, seed the initial roles, administrator, warehouse, routes, rate card, and demo accounts:

```powershell
docker compose -f docker/compose.yml exec api npm run db:seed --workspace=@shipit/database
```

Open the staff portal at `http://localhost:3000`, merchant portal at `http://localhost:3001`, rider PWA at `http://localhost:3002`, public website at `http://localhost:3003`, and API health at `http://localhost:4000/api/health`. The seeded Super Admin uses `SHIPIT_ADMIN_EMAIL`; demo merchant and rider logins are `merchant@glowaura.co.ke` and `rider@shipit.co.ke`. All seeded accounts use the `SHIPIT_ADMIN_PASSWORD` value from `.env`. Mailpit is at `http://localhost:8025`; MinIO console is at `http://localhost:9001`.

Stop the stack with `docker compose -f docker/compose.yml down`; add `-v` only when you intend to delete local database, Redis, and MinIO data.

## Backend Integrations

The API and worker require Redis. The worker consumes durable BullMQ domain events and forwards them to `SHIPIT_EVENTS_WEBHOOK_URL` when configured. It retries transient webhook failures with exponential backoff.

For Daraja, configure the consumer key/secret, shortcode, passkey, initiator name, B2C security credential, callback token, and a publicly reachable callback base URL in `.env`. Safaricom must be able to reach that base URL; localhost is suitable only for local development through a public tunnel. Register these callback paths with Daraja, appending `?token=<MPESA_CALLBACK_TOKEN>`:

- `/api/webhooks/mpesa/c2b/validation`
- `/api/webhooks/mpesa/c2b/confirmation`
- `/api/webhooks/mpesa/b2c/result`
- `/api/webhooks/mpesa/b2c/timeout`

STK Push uses `/api/webhooks/mpesa/stk` automatically. Successful M-Pesa callbacks are receipt-idempotent. B2C settlements remain in `PROCESSED` until the result callback confirms payment.

Bulk order import is `POST /api/orders/import` with `Content-Type: text/csv`. Each product occupies one row; rows sharing `merchant_id` and `external_reference` become one order. Required headers are `merchant_id`, `external_reference`, `customer_name`, `customer_phone`, `county`, `town_or_sub_county`, `estate_or_area`, `landmark`, `payment_method`, `product_sku`, `quantity`, and `unit_price_kes`. Optional columns include `customer_alt_phone`, `building_or_court`, `gps_latitude`, `gps_longitude`, `google_maps_url`, `whatsapp_location_text`, `delivery_fee_kes`, `preferred_delivery_date`, and `verification_notes`. The whole import is atomic: any invalid row, unknown SKU, duplicate reference, or inventory shortfall rejects the batch.

## Host-run backend

To run the database and Redis in Docker while starting the Node processes on the host:

```powershell
npm run db:up
Copy-Item packages/database/.env.example packages/database/.env
Copy-Item services/api/.env.example services/api/.env
npm run db:migrate
npm run db:seed
npm run dev:api
```

Set a unique administrator email and password in `packages/database/.env` before seeding. The password must be at least 16 characters. `services/api/.env` must point `DATABASE_URL` to the same local database and set `REDIS_URL=redis://localhost:6379`. Run `npm run dev:worker` in another terminal to consume domain events.

The migration creates the operational schema. The seed provisions roles and permissions, the initial administrator, warehouse locations, routes, and the standard Kenya rate card. After logging in as the seeded administrator, use the authenticated merchant, product, and rider provisioning endpoints to populate operational accounts.

The included Compose credentials are for local development only. Use managed secrets and a production PostgreSQL service outside local development.
