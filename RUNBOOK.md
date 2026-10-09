# SHIP IT — PRODUCTION OPERATIONAL RUNBOOK & PILOT READINESS GATE
## System Administration, Deployment Architecture & Incident Playbook

---

## 1. SYSTEM TOPOLOGY & ARCHITECTURE

Ship It is an **Emergency & High-Velocity Fulfillment Operating System (FOS)** designed for emerging, mobile-money-first markets with zero untracked movements and exception-first operational oversight.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PUBLIC COMMERCIAL INGRESS                          │
│     Marketing Website: https://shipit.co.ke                                │
│     Staff Control Tower: https://app.shipit.co.ke                          │
│     Merchant Self-Service: https://merchant.shipit.co.ke                   │
│     Rider Operations PWA: https://rider.shipit.co.ke                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                [ NGINX GATEWAY ]
                                  (Port 80/443)
                  ┌────────────────────┴────────────────────┐
                  │ /api/                                   │ /api/events/stream
                  ▼                                         ▼
        ┌─────────────────────────────────────────────────────────┐
        │                 SHIP IT MODULAR API                     │
        │             (Express + Node.js 20 Alpine)               │
        │                                                         │
        │  * JWT Authentication & Granular Permission Matrix      │
        │  * WMS & Multi-Zone Inventory Allocation Engine         │
        │  * Wave Picking & Audio Barcode Waybill Verification    │
        │  * Vector Route Radar & Manifest Handover               │
        │  * Real-Time NDR Interception & Automated SMS/WhatsApp  │
        │  * Daraja STK Push, C2B Paybill & B2C Disbursement      │
        │  * Shift Cash Reconciliation & Merchant Ledgers         │
        └───────────────────────────┬─────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
   [ PostgreSQL 16 ]                               [ Redis 7 + BullMQ ]
(Relational Data, Ledgers,                       (In-Memory SSE Pub/Sub,
  Audit Logs & ACID Models)                     Domain Queues & Retries)
           │                                                 │
           ▼                                                 ▼
[ Automated 14-Day Backups ]                       [ Background Worker ]
   (gzip + S3 Cloud Sync)                         (Transactional Dispatch)
```

---

## 2. ENVIRONMENT VARIABLES CONFIGURATION

Create `.env` in the repository root or supply variables to your container orchestrator:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment mode | `production` |
| `PORT` | API server listen port | `4000` |
| `DATABASE_URL` | PostgreSQL connection pool URL | `postgresql://shipit:secret@postgres:5432/shipit?schema=public` |
| `REDIS_URL` | Redis instance URL | `redis://:secret@redis:6379` |
| `CORS_ORIGINS` | Permitted browser origins | `https://shipit.co.ke,https://app.shipit.co.ke` |
| `MPESA_ENV` | Daraja environment | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY` | Safaricom Daraja Consumer Key | `alphanumeric` |
| `MPESA_CONSUMER_SECRET`| Safaricom Daraja Consumer Secret | `alphanumeric` |
| `MPESA_SHORTCODE` | Paybill / Till Shortcode | `600982` |
| `MPESA_PASSKEY` | STK Push Lipa Na M-Pesa Passkey | `base64_string` |
| `MPESA_INITIATOR_NAME` | B2C Disbursement Operator Initiator | `shipit_payout` |
| `MPESA_B2C_SECURITY_CREDENTIAL` | Encrypted B2C Public Key Credential | `base64_string` |
| `MPESA_CALLBACK_URL` | Public webhook callback base URL | `https://api.shipit.co.ke` |
| `MPESA_CALLBACK_TOKEN`| Webhook verification bearer token | `secure_random_string` |
| `AFRICASTALKING_API_KEY`| Africa's Talking SMS API Key | `alphanumeric` |
| `AFRICASTALKING_USERNAME`| Africa's Talking Account Username | `sandbox` or `shipit` |
| `AFRICASTALKING_SENDER_ID`| Approved Alphanumeric SMS Sender ID | `SHIPIT` |
| `WHATSAPP_API_TOKEN` | Meta WhatsApp Cloud API Token | `bearer_token` |
| `WHATSAPP_PHONE_ID` | Meta Cloud Registered Phone Number ID | `numeric_id` |

---

## 3. DEPLOYMENT PROCEDURES

### 3.1 Cold-Start Deployment via Docker Compose

1. **Clone the repository on the host server:**
   ```bash
   git clone https://github.com/Voskykelvin/shipit.git /opt/shipit
   cd /opt/shipit
   ```

2. **Configure environment credentials:**
   ```bash
   cp .env.example .env
   # Edit .env with production passwords and API credentials
   ```

3. **Start the database and cache infrastructure:**
   ```bash
   docker compose -f docker/compose.prod.yml up -d postgres redis
   ```

4. **Run database migrations and seed initial roles:**
   ```bash
   docker compose -f docker/compose.prod.yml run --rm api npm run db:migrate:deploy --workspace=@shipit/database
   docker compose -f docker/compose.prod.yml run --rm api npm run db:seed --workspace=@shipit/database
   ```

5. **Launch all services:**
   ```bash
   docker compose -f docker/compose.prod.yml up -d
   ```

6. **Verify health check endpoints:**
   ```bash
   curl -I http://localhost/api/health
   curl http://localhost/api/health/ready
   ```

---

## 4. DATABASE BACKUP & DISASTER RECOVERY

### 4.1 Automated Nightly Backup Cron
Add the backup script to system crontab on the host server:
```bash
# Run database backup every night at 02:00 AM EAT
0 2 * * * /opt/shipit/scripts/backup-db.sh >> /var/log/shipit-db-backup.log 2>&1
```

The backup script automatically:
1. Streams a compressed `pg_dump` to `/backups/postgres/shipit_db_backup_YYYYMMDD_HHMMSS.sql.gz`.
2. Syncs to AWS S3 if `S3_BACKUP_BUCKET` is configured.
3. Automatically prunes backups older than 14 days.

### 4.2 Disaster Recovery / Restoring from Backup
To restore a snapshot in the event of hardware or storage loss:
```bash
# Ensure target database is ready, then run restore script:
/opt/shipit/scripts/restore-db.sh /backups/postgres/shipit_db_backup_20261009_020000.sql.gz
```

---

## 5. REAL-TIME OPERATIONAL WORKFLOWS & AUDIO ERGONOMICS

### 5.1 Real-Time Server-Sent Events (SSE) Stream
- **Endpoint:** `GET /api/events/stream`
- **Features:** Instant in-memory broadcast for `ndr.created`, `manifest.dispatched`, `delivery.completed`, and `order.created`.
- **Client Fallback:** If SSE connection disconnects, client automatically reconnects with exponential backoff (2s → 30s) while polling fallback stays active.

### 5.2 Synthesized Web Audio Cues
- **Scan Match / Success:** Dual-oscillator chime (523Hz `C5` + 659Hz `E5`, triangle wave, 120ms duration).
- **Route Mismatch / Safety Block:** Dual-oscillator sawtooth buzz (140Hz + 120Hz, 320ms duration).
- **Urgent NDR Interception Alert:** Triple ascending alert sweep (350Hz → 750Hz, square wave) alerting customer care to dial customer immediately while rider is still on site.

### 5.3 M-Pesa Finance Operator Console
- Operators access the **M-Pesa Operator Console** inside the Staff Portal Finance tab.
- Inspects real-time STK Push prompts, Paybill C2B transactions, and B2C merchant settlements.
- **Manual Force Reconciliation:** Enter any orphaned Paybill `TransID` + `Order Number` to immediately match the receipt, generate the `COD_CREDIT` transaction, and credit the merchant's financial ledger.

---

## 6. PRE-LAUNCH PILOT READINESS GATE CHECKLIST

Before onboarding live commercial merchant inventory, verify all 10 operational gates:

- [x] **Gate 1: Multi-Tenant Database Isolation:** Database migrations deployed with unique constraints on merchant catalogs, waybills, and ledgers.
- [x] **Gate 2: Modular Frontend Portals:** Staff, Merchant, Rider PWA, and Commercial Marketing Website build cleanly with zero type errors.
- [x] **Gate 3: Barcode Waybill & Manifest Safety:** Routing engine blocks route mismatches with audio buzzer and visual error banner.
- [x] **Gate 4: Real-Time NDR Engine:** Failed delivery attempts trigger urgent alert sweep, instant SSE notification, and automated customer SMS.
- [x] **Gate 5: Mobile Money Dual-Channel Engine:** STK push triggers prompted to recipient; C2B Paybill webhook validation matches order number.
- [x] **Gate 6: Rider Shift Lockout:** End-of-day cash reconciliation prevents closeout on cash shortage without explicit manager audit note.
- [x] **Gate 7: Append-Only Financial Ledgers:** All credits and debits derive from immutable ledger entries; double-entry balances verified.
- [x] **Gate 8: Multi-Stage Containerization:** Production Dockerfiles created for API, Worker, and Nginx Web Gateway.
- [x] **Gate 9: Automated Disaster Recovery:** PostgreSQL backup script with 14-day rotation and restore script tested.
- [x] **Gate 10: Continuous Integration:** GitHub Actions CI workflow executing lint, typecheck, database validation, and multi-workspace builds.
