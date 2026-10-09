# SHIP IT — MASTER FULFILLMENT OPERATING SYSTEM
## Master Product, Operations, Architecture & Engineering Blueprint

---

## 1. EXECUTIVE VISION & OPERATING PHILOSOPHY

**Ship It** is not a courier landing page or a basic parcel-tracking portal. It is a complete **Fulfillment Operating System (FOS)** designed specifically for physical goods commerce in emerging and mobile-money-centric markets (starting with Kenya and expanding across East Africa).

The platform bridges the entire operational chain:
```
Merchant ──> ASN Inbound ──> Warehouse Receiving ──> Storage/Putaway ──> 
Order Import/Creation ──> Pre-Dispatch Verification ──> Wave/Single Picking ──> 
Packing & Barcode Waybill ──> Route Manifest & Custody Handover ──> Last-Mile Dispatch ──> 
Proof of Delivery & COD Collection (M-Pesa / Cash) ──> End-of-Day Rider Reconciliation ──> 
Returns/NDR/RTO Inspection ──> Merchant Ledger Settlement
```

### The Central Tenet
> **Zero Untracked Movements:** No physical item moves, no parcel changes hands, and no shilling is collected without an immutable, auditable digital transaction in the ledger.

### Core Operating Differentiator: Exception-First Architecture
Rather than forcing operations and management staff to comb through thousands of healthy records, the system acts as an **Operational Control Tower** highlighting anomalies immediately:
- **Customer Care:** Orders pending address verification > 2 hours, unreachable customer alerts.
- **Warehouse:** Stock allocation shortfalls, pick discrepancies, unassigned putaway.
- **Operations:** Parcels scanned to mismatched route manifests, dispatch bottlenecks.
- **Delivery (NDR Engine):** Instant alerts when a rider reports "customer unavailable" while the rider is still within the delivery neighborhood.
- **Finance:** Unreconciled M-Pesa transactions, cash variances on rider shift closeout, pending merchant payouts.

---

## 2. SCOPE AUDIT: FEATURES ADDED, REFINED & PRUNED

To ensure commercial feasibility and operational velocity, the feature set is strictly tiered.

### 2.1 Removed / Deferred from MVP (Out of Place for Stage 1)
| Feature | Reason for Removal / Deferral | Deferred Phase |
| :--- | :--- | :--- |
| **Microservices Architecture** | Unnecessary operational overhead, network latency, distributed transaction complexity. | Modular Monolith indefinitely until multi-team scale |
| **Kafka Event Streams** | Premature infrastructure overhead for current order volumes. Handled cleanly with PostgreSQL + Redis/BullMQ. | Phase 3 |
| **AI Demand & RTO Forecasting** | Requires historical baseline data to train. Rules-based address/customer verification provides 90% of the value immediately. | Phase 3 |
| **Dynamic AI Route Optimization** | Impractical for unstructured Nairobi suburban addressing; simple zoned route manifests and Google Maps navigation are significantly more reliable. | Phase 2 / Phase 3 |
| **Native Mobile Apps (iOS/Android)** | App store deployment friction, multi-platform overhead, update lag. PWA solves camera barcode scanning, offline caching, and responsive workflows. | Phase 2 |
| **Automated Shopify / WooCommerce Plugins** | Adds external dependency risk during warehouse loop testing. High-speed CSV and bulk API imports come first. | Phase 2 (Weeks 13–16) |
| **Full General Ledger / Double-Entry ERP** | Ship It is a fulfillment engine, not an accounting suite. Replaced by a dedicated **Fulfillment Financial Ledger** (COD, fees, rate cards, merchant balances). | Native export to ERP in Phase 3 |
| **Value-Added Studio Services (Photography, etc.)** | Distracts from core logistics operational efficiency. | Dropped entirely |
| **Multi-Country & Multi-Currency** | Currency volatility and regulatory overhead. MVP strictly targets Kenya (KES + M-Pesa). | Phase 3 |

### 2.2 Critical Additions & Localized Enhancements (Included in Core)
1. **Kenya-Specific Address Intelligence:** Non-standard addressing engine supporting County, Sub-County/Town, Estate/Neighborhood, Building/Court, Floor/Unit, Landmark (e.g., "Opposite Total Energies, green gate"), WhatsApp Pin URL, and Lat/Long coordinates.
2. **Real-Time NDR (Non-Delivery Report) Interception:** When a rider triggers a failed delivery attempt, Customer Care receives an immediate high-priority alert with direct WhatsApp and click-to-call links to resolve the issue while the rider is still on site.
3. **Automated Daraja M-Pesa Integration:** Dual-mode payment processing via STK Push (prompted by rider app directly to customer phone) and C2B Paybill validation with instant webhook ledger reconciliation.
4. **Shift-Locked Rider Reconciliation:** Riders cannot finalize daily shift handovers without explicit manager override if expected cash vs. collected cash/M-Pesa reflects a variance.
5. **Pre-Dispatch Verification Queue:** Optional merchant rule engine routing high-risk or COD orders through phone/WhatsApp confirmation prior to inventory picking, cutting RTO rates by up to 60%.
6. **Immutable Ledger Transactions:** Quantities and balances are derived from append-only transaction logs (`InventoryTransaction` and `MerchantLedger`), preventing race conditions and silent manual overrides.

---

## 3. MASTER TARGET ARCHITECTURE

### 3.1 High-Level Architecture Topology
```
                             [ PUBLIC COMMERCIAL WEBSITE ]
                               (Next.js / SSR / Marketing)
                                            │
                                            ▼
                             [ SECURE CLOUD GATEWAY ]
                             (JWT / RBAC / Rate Limiting)
                                            │
                ┌───────────────────────────┴───────────────────────────┐
                ▼                                                       ▼
      [ STAFF FOS DASHBOARD ]                                 [ MERCHANT SELF-SERVICE PORTAL ]
      (React + Vite + Tailwind)                               (Next.js + React Query + Tailwind)
                │                                                       │
                └───────────────────────────┬───────────────────────────┘
                                            │
                                            ▼
                               [ RIDER PROGRESSIVE WEB APP ]
                                (Mobile PWA + Barcode Scan)
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │       MODULAR BACKEND ENGINE (NestJS)         │
                    │                                               │
                    │  [Auth & RBAC]         [Inventory Engine]     │
                    │  [Merchant Tenancy]    [Inbound/Receiving]    │
                    │  [Order Management]    [Pick/Pack Engine]     │
                    │  [Waybill Generator]   [Dispatch & Routing]   │
                    │  [Rider Management]    [COD & M-Pesa Engine]  │
                    │  [Returns / NDR]       [Finance & Settlement] │
                    │  [Customer Care Desk]  [Audit & Control Tower]│
                    └───────────────────────────────────────────────┘
                                    │               │
                            ┌───────┴───────┐   ┌───┴──────────┐
                            ▼               ▼   ▼              ▼
                     [ PostgreSQL 16 ]     [ Redis 7 + BullMQ ]
                     (Relational Data +    (Job Queues, Labels,
                      Ledgers & Audits)     Webhooks & SMS/WhatsApp)
```

### 3.2 Monorepo Codebase Structure
The following is the current repository layout. The diagram in 3.1 is a target blueprint; it does not describe the current framework choices or imply that every target feature is implemented.
```text
shipit/
├── apps/
│   ├── staff-portal/         # Internal operations app (React + Vite)
│   ├── merchant-portal/      # Merchant self-service app (React + Vite)
│   └── rider-pwa/            # Rider delivery app (React + Vite)
├── services/
│   └── api/                  # Express + TypeScript REST API and background worker
├── packages/
│   ├── api-client/           # Shared authenticated browser API client
│   ├── database/             # Prisma schema, migrations and seed
│   ├── shared-types/         # Cross-application TypeScript contracts
│   └── validation/           # Shared Zod request schemas
└── docker/
    └── compose.yml           # Local PostgreSQL and Redis services
```
There is currently no `apps/website`, standalone `services/worker`, shared UI package, or Next.js/NestJS application in this repository.

---

## 4. DATABASE & DATA MODEL SPECIFICATION (POSTGRESQL)

All mission-critical entities are isolated by `merchant_id` for multi-tenant security. Financial and inventory states are strictly append-only.

### 4.1 Core Entity Schemas

#### Tenancy & Users
* **`merchants`**: `id`, `name`, `code`, `contact_email`, `contact_phone`, `billing_tier`, `rate_card_id`, `status` (ACTIVE, SUSPENDED), `mpesa_b2c_phone`, `bank_details_json`, `created_at`, `updated_at`.
* **`users`**: `id`, `merchant_id` (nullable for internal staff), `email`, `phone`, `password_hash`, `first_name`, `last_name`, `status`, `last_login_at`.
* **`roles`**: `id`, `name` (SUPER_ADMIN, OPERATIONS_MANAGER, WAREHOUSE_SUPERVISOR, WAREHOUSE_PICKER, CUSTOMER_CARE_AGENT, DISPATCHER, RIDER, FINANCE_OFFICER, MERCHANT_ADMIN, MERCHANT_STAFF), `description`.
* **`permissions`**: `id`, `slug` (e.g., `inventory.adjust`, `settlement.approve`, `order.verify`).
* **`role_permissions`**: `role_id`, `permission_id`.

#### Warehousing & Locations
* **`warehouses`**: `id`, `code`, `name`, `address_json`, `is_active`.
* **`warehouse_locations`**: `id`, `warehouse_id`, `zone` (e.g., "BULK", "FAST_PICK", "QUARANTINE"), `aisle`, `rack`, `shelf`, `bin`, `barcode` (e.g., "W1-A02-R03-S1-B04"), `max_weight_kg`, `is_occupied`.
* **`products`**: `id`, `merchant_id`, `sku`, `barcode`, `name`, `description`, `declared_value`, `weight_kg`, `reorder_threshold`, `is_fragile`, `requires_cold_storage` (false default), `created_at`.

#### Inbound Logistics
* **`inbound_shipments (ASN)`**: `id`, `merchant_id`, `warehouse_id`, `asn_number`, `status` (EXPECTED, PARTIALLY_RECEIVED, COMPLETED, CANCELLED), `expected_delivery_date`, `notes`.
* **`inbound_items`**: `id`, `inbound_shipment_id`, `product_id`, `expected_units`, `received_units`, `damaged_units`, `location_id`.
* **`goods_received_notes (GRN)`**: `id`, `inbound_shipment_id`, `grn_number`, `verified_by_user_id`, `generated_at`, `merchant_signed_off_at`.

#### Inventory Ledger (Strictly Append-Only)
* **`inventory_levels`**: `id`, `product_id`, `location_id`, `available_qty`, `reserved_qty`, `damaged_qty`, `quarantine_qty`, `updated_at`.
* **`inventory_transactions`**: `id`, `product_id`, `location_id`, `source_type` (ASN_RECEIVE, ORDER_RESERVATION, ORDER_PICK, RETURN_RESTOCK, RETURN_DAMAGE, MANUAL_ADJUSTMENT), `source_id` (e.g., order_id, grn_id), `delta_available`, `delta_reserved`, `delta_damaged`, `performed_by_user_id`, `supervisor_approved_by`, `reason_code`, `created_at`.

#### Orders & Fulfillment Pipeline
* **`orders`**:
  * `id`, `merchant_id`, `order_number` (e.g., "ORD-2026-90412"), `external_reference`, `order_source` (MANUAL, CSV, API, SHOPIFY).
  * `customer_name`, `customer_phone`, `customer_alt_phone`, `county`, `town`, `estate_area`, `building_unit`, `landmark_description`, `gps_latitude`, `gps_longitude`, `google_maps_url`.
  * `order_value_kes`, `delivery_fee_kes`, `cod_amount_expected_kes`, `payment_method` (COD_MPESA, COD_CASH, PREPAID).
  * `status` (PENDING_VERIFICATION, CONFIRMED, READY_FOR_PICK, PICKING, PACKED, MANIFESTED, DISPATCHED, OUT_FOR_DELIVERY, DELIVERED, NDR_EXCEPTION, RETURN_IN_TRANSIT, RETURNED_TO_WAREHOUSE, CANCELLED).
  * `verification_notes`, `verified_by_user_id`, `verified_at`, `created_at`, `updated_at`.
* **`order_items`**: `id`, `order_id`, `product_id`, `quantity`, `unit_price_kes`, `allocated_location_id`.
* **`waybills`**: `id`, `order_id`, `tracking_number` (e.g., "WB-98234-KE"), `barcode_code128`, `qr_code_payload`, `label_pdf_url`, `generated_at`.
* **`pick_waves`**: `id`, `wave_number`, `assigned_to_user_id`, `status` (CREATED, IN_PROGRESS, COMPLETED), `started_at`, `completed_at`.
* **`pick_tasks`**: `id`, `pick_wave_id`, `order_item_id`, `target_location_id`, `scanned_barcode`, `is_confirmed`, `picked_at`.

#### Dispatch, Routes & Delivery Execution
* **`delivery_routes`**: `id`, `route_code` (e.g., "NBO-WESTLANDS-01", "NBO-THIKA-RD-02"), `name`, `sub_counties_served_json`.
* **`riders`**: `id`, `user_id`, `national_id_number`, `vehicle_reg_plate`, `phone_number`, `active_status` (OFF_DUTY, ON_DUTY, IN_TRANSIT), `current_cash_held_kes`.
* **`dispatch_manifests`**: `id`, `manifest_number` (e.g., "MNF-2026-0881"), `route_id`, `rider_id`, `status` (STAGED, ACCEPTED_BY_RIDER, IN_TRANSIT, CLOSED), `total_parcels`, `expected_cod_total_kes`, `dispatched_at`, `closed_at`.
* **`delivery_attempts`**: `id`, `order_id`, `manifest_id`, `rider_id`, `attempt_number`, `status` (SUCCESS, FAILED), `failure_reason` (CUSTOMER_UNREACHABLE, WRONG_LOCATION, RESCHEDULE_REQUESTED, REFUSED_DELIVERY, CASH_SHORTAGE), `reschedule_date`, `rider_notes`, `gps_latitude`, `gps_longitude`, `attempt_timestamp`.
* **`proof_of_delivery (POD)`**: `id`, `order_id`, `rider_id`, `recipient_name`, `signature_image_url`, `parcel_photo_url`, `gps_lat`, `gps_lng`, `delivered_timestamp`.

#### COD Clearing & Financial Ledger
* **`cod_transactions`**: `id`, `order_id`, `merchant_id`, `rider_id`, `payment_channel` (MPESA_STK, MPESA_C2B, CASH), `amount_collected_kes`, `mpesa_receipt_number`, `status` (PENDING_SETTLEMENT, RECONCILED, DISPUTED), `collected_at`.
* **`rider_shifts`**: `id`, `rider_id`, `shift_date`, `opening_timestamp`, `closing_timestamp`, `total_cod_expected_kes`, `mpesa_collected_kes`, `cash_expected_kes`, `cash_handed_in_kes`, `variance_kes`, `is_reconciled`, `supervisor_approved_user_id`, `variance_reason_notes`.
* **`merchant_ledgers`**: `id`, `merchant_id`, `transaction_type` (COD_CREDIT, FULFILLMENT_FEE_DEBIT, STORAGE_FEE_DEBIT, DELIVERY_FEE_DEBIT, RETURN_PENALTY_DEBIT, ADJUSTMENT), `order_id` (nullable), `amount_kes`, `running_balance_kes`, `description`, `created_at`.
* **`merchant_settlements`**: `id`, `merchant_id`, `settlement_number`, `period_start`, `period_end`, `gross_cod_kes`, `deducted_fees_kes`, `net_payout_kes`, `status` (DRAFT, APPROVED, PROCESSED, PAID), `payout_reference` (M-Pesa B2C or Bank Ref), `approved_by_user_id`, `disbursed_at`.

#### Reverse Logistics & NDR
* **`ndr_cases`**: `id`, `order_id`, `delivery_attempt_id`, `status` (OPEN, ESCALATED, RESOLVED_FOR_REDELIVERY, RESOLVED_FOR_RTO), `assigned_agent_id`, `action_taken` (CALLED_CUSTOMER, WHATSAPP_SENT, ADDRESS_UPDATED), `resolution_notes`, `created_at`, `closed_at`.
* **`returns`**: `id`, `order_id`, `merchant_id`, `return_type` (IMMEDIATE_RTO, CUSTOMER_POST_DELIVERY_RETURN), `status` (RETURN_INITIATED, IN_TRANSIT, RECEIVED_AT_WAREHOUSE, INSPECTED), `initiated_at`.
* **`return_inspections`**: `id`, `return_id`, `inspected_by_user_id`, `sku_id`, `condition_grade` (GRADE_A_RESTOCKABLE, GRADE_B_DAMAGED_PACKAGING, GRADE_C_DAMAGED_PRODUCT, WRONG_ITEM_RETURNED), `action` (RESTOCKED_TO_AVAILABLE, QUARANTINED, RETURNED_TO_MERCHANT), `photos_json`, `inspected_at`.

#### Auditing & Security
* **`audit_logs`**: `id`, `user_id`, `merchant_id`, `entity_type` (ORDER, INVENTORY, SETTLEMENT, MANIFEST), `entity_id`, `action` (CREATE, UPDATE, DELETE, OVERRIDE, APPROVE), `before_payload_json`, `after_payload_json`, `ip_address`, `user_agent`, `timestamp`.

---

## 5. COMPLETE OPERATIONAL WORKFLOWS

### 5.1 Inbound Receiving & Putaway
```text
Merchant submits ASN via Portal
              │
              ▼
Truck arrives at Warehouse Bay
              │
              ▼
Receiving clerk opens ASN in Staff Portal
              │
              ▼
Clerk scans SKU Barcodes & inputs count (Pass vs. Damaged)
              │
              ▼
System prints GRN (Goods Received Note) ──> Merchant receives digital copy
              │
              ▼
System suggests Putaway Bins based on Zone & SKU Velocity
              │
              ▼
Picker scans: [LOCATION BARCODE] ──> [SKU BARCODE] ──> [QUANTITY]
              │
              ▼
Inventory ledger increments 'available_qty' in real-time
```

### 5.2 Order Verification & Fraud Shield (COD Optimization)
```text
Order ingested (Manual / CSV upload / API)
              │
              ▼
System checks: Is Payment COD?
     ├── NO (Prepaid) ──> Immediately status: READY_FOR_PICK
     └── YES (COD)
              │
              ▼
Order enters Customer Care Verification Queue
              │
              ▼
Agent validates Phone & Landmark via click-to-call or WhatsApp macro:
     ├── Customer Unreachable (3 attempts) ──> Hold / Cancelled
     ├── Customer Cancelled / Fake Order ──> Voided (Zero warehouse labor spent)
     └── Customer Confirmed Delivery Date/Time ──> CONFIRMED ──> READY_FOR_PICK
```

### 5.3 Pick, Pack & Waybill Generation
```text
Fulfillment Manager generates Pick Wave (Batch of orders by Route/Zone)
              │
              ▼
Warehouse Staff receives Pick List on handheld/tablet:
  * Guided bin sequence (e.g., Aisle 1 ──> Aisle 2 ──> Aisle 3)
  * Barcode scan validation prevents wrong-item picking
              │
              ▼
Items arrive at Packing Station:
  1. Operator scans Order ID
  2. Operator scans each physical product
  3. Digital Scale verification confirms expected weight delta
  4. System triggers 4x6 Thermal Label Printer (Waybill generated with Code128 + QR)
  5. Operator attaches Waybill ──> Parcel marked PACKED
```

### 5.4 Dispatch & Custody Handover
```text
Packed parcels placed in Route Staging Bins (e.g., "WESTLANDS-01")
              │
              ▼
Dispatcher creates Daily Run Sheet / Manifest:
  * Scans each Waybill barcode
  * SYSTEM SAFETY CHECK: If parcel belongs to "KILIMANI-02", audio buzzer sounds 
    and UI blocks addition to Westlands manifest
              │
              ▼
Assigned Rider accepts custody on Rider PWA:
  * Rider scans/verifies total parcel count & expected COD figure
  * Digital signature marks parcels: OUT_FOR_DELIVERY
  * Custody officially transferred from Warehouse to Rider
```

### 5.5 Last-Mile Delivery & Real-Time NDR Engine
```text
Rider follows stop sequence on Rider PWA:
              │
              ├── SUCCESSFUL DELIVERY
              │     1. Rider requests payment:
              │          * Option A: STK Push triggered to customer's M-Pesa
              │          * Option B: Customer pays Paybill ──> Webhook matches
              │          * Option C: Cash collected & entered
              │     2. Rider captures recipient signature / photo
              │     3. Geotag + Timestamp logged ──> Status: DELIVERED
              │
              └── FAILED ATTEMPT (Customer unreachable / rescheduled)
                    │
                    ▼
              Rider selects failure reason code in PWA
                    │
                    ▼
              INSTANT EVENT: ndr.created
                    │
                    ▼
              Staff Customer Care Control Tower alerts assigned agent
                    │
                    ▼
              Agent dials customer immediately while rider is still in neighborhood
                    ├── If resolved: Agent tells rider to retry stop
                    └── If failed: Rescheduled or marked for Return-to-Warehouse
```

### 5.6 End-of-Day Shift Closeout & Cash Clearing
```text
Rider returns to hub at end of shift:
              │
              ▼
Finance / Operations opens Rider Reconciliation Terminal:
  * Total COD Expected:       e.g., KES 65,000
  * Verified M-Pesa Matches:  e.g., KES 42,000
  * Expected Physical Cash:   e.g., KES 23,000
              │
              ▼
Cashier counts handed-in physical notes:
  * Case 1: KES 23,000 counted ──> Zero Variance ──> Shift CLOSED
  * Case 2: KES 22,000 counted (KES 1,000 shortage) ──> 
    System prevents standard closeout. Shift locked under DISPUTED_VARIANCE.
    Requires Supervisor sign-off and deducts from rider balance.
```

### 5.7 Merchant Ledger Settlement
```text
COD cleared into Ship It corporate collection accounts
              │
              ▼
Nightly Ledger Engine credits Merchant Account with collected COD
              │
              ▼
System calculates & debits contract rate card fees:
  * Storage fee per cubic meter / bin
  * Pick & Pack fee per order
  * Last-mile delivery fee
  * COD remittance commission (% or flat)
  * Return processing fee (if applicable)
              │
              ▼
Net Balance available for Settlement:
  * Weekly or On-Demand payout requested by Merchant
  * Finance reviews and clicks [APPROVE DISBURSEMENT]
  * Funds disbursed via automated M-Pesa B2C or Bank EFT with audit reference
```

---

## 6. IMPLEMENTED BACKEND-TO-FRONTEND FEATURE MAP

The current clients are React/Vite applications backed by the authenticated Express API. Staff screens and navigation are permission-aware; API authorization remains authoritative. Backend webhooks and background jobs are server-to-server features, not interactive portal pages.

| Backend domain / API capability | Frontend surface | Current coverage and boundary |
| :--- | :--- | :--- |
| Login, logout, session permissions | All three portals via `packages/api-client` | Bearer-token login/logout; staff navigation and action controls are gated by permissions. |
| Control-tower KPIs and exceptions | Staff: Control tower | Summary and audit-visible exceptions. |
| Orders, verification, cancellation, CSV import, waybill PDFs | Merchant: Orders; Staff: Orders & verification | Merchants create orders, upload CSVs and download generated labels. Staff review/verify, cancel and import. |
| Inventory balances, transactions, locations, adjustments | Merchant: Inventory; Staff: WMS & inbound | Merchants view stock/ledger-derived quantities; staff can see permitted location and transaction data and post permitted adjustments. |
| Inbound warehouse lookup, ASN creation and receiving | Merchant: Inventory & inbound; Staff: WMS & inbound | Merchant ASN scheduling and staff receipt with received/damaged quantities. Staff actions are permission-gated. |
| Pick waves, task confirmation and packing | Staff: Pick & pack | Wave lifecycle, barcode-confirmed picking and order packing. |
| Routes, manifests, route scans and custody handover | Staff: Dispatch | Staged manifest creation, route validation, parcel scans and permitted handover. |
| Rider task lookup, delivery completion/failure, M-Pesa STK initiation | Rider: assigned stops | Riders fetch their own tasks, contact/navigate to recipients, initiate STK, submit delivery/POD details, or report failure. |
| NDR case resolution | Staff: NDR exceptions | Permitted users retry delivery or route a parcel to RTO. |
| Return creation, receiving and inspection | Staff: Returns | Staff with matching permissions create returns, enter actual received quantities and quarantine locations, and select condition grades and disposition actions. |
| Rider shift reconciliation, cash-variance approval, merchant ledgers and settlement lifecycle | Merchant: Finance; Staff: Finance | Merchants view ledger/settlement history and request settlements. Staff reconcile shifts; operations managers and super admins review and approve cash variances with an explicit reason. Authorized finance staff create, approve or disburse/mark settlements. |
| Merchant, merchant-user, product and rider provisioning | Staff: Merchants & fleet | Onboarding and catalog/rider setup are available to users with the matching permissions. |
| Public shipment tracking | Merchant portal: Public tracking tab | Uses unauthenticated `/tracking/:trackingNumber`; a standalone marketing/public website is not present. |
| M-Pesa callbacks, B2C result callbacks and background domain jobs | API/webhook and worker processes | Backend integrations execute without an operator-facing callback-monitoring screen. |

### 6.1 Current Client Limits (Not Yet Implemented)
- There is no separate public marketing website.
- The rider app does not currently provide offline task caching, camera barcode scanning, signature capture, or photo upload.
- STK initiation is asynchronous; the rider app does not poll callback state. The rider enters the customer-confirmed M-Pesa receipt before completing a delivery.
- The staff finance UI does not provide a dedicated M-Pesa callback reconciliation console or rate-card builder.
- Control-tower and portal views are API-backed, but no live database/API end-to-end browser test is implied by a successful compile.

---

## 7. WAYBILL & HARDWARE SPECIFICATIONS

### 7.1 Thermal Waybill Format (4 × 6 Inch / 100 × 150 mm)
Waybills are dynamically compiled into crisp 203 DPI PDF/ZPL streams:
```text
┌─────────────────────────────────────────────────────────────┐
│  SHIP IT EXPRESS                  TRACKING: WB-98234-KE     │
├─────────────────────────────────────────────────────────────┤
│  [|||||||||||||||||||||||||||||||||||||||||||||||||||||||]  │
│                       *WB-98234-KE*                         │
├──────────────────────────────┬──────────────────────────────┤
│ DESTINATION ROUTE:           │ PAYMENT METHOD:              │
│   NBO-WESTLANDS-01           │   COD (CASH ON DELIVERY)     │
│                              │   AMOUNT: KES 3,500          │
├──────────────────────────────┴──────────────────────────────┤
│ RECIPIENT:                                                  │
│   Jane Wambui (+254 712 *** 890)                            │
│   Westlands, Rhapta Road                                    │
│   Parkview Heights, 3rd Floor, Apt 3B                       │
│   Landmark: Opposite Shell Petrol Station, Black Gate       │
├─────────────────────────────────────────────────────────────┤
│ MERCHANT: BeautyGlow Kenya     │ ORDER REF: ORD-49102       │
├────────────────────────────────┬────────────────────────────┤
│ ITEMS:                         │ WEIGHT: 1.2 kg             │
│   1x Glow Radiance Serum 50ml  │ PIECES: 2                  │
│   1x Hydrating Day Cream       │                            │
├────────────────────────────────┴────────────────────────────┤
│ INSTRUCTIONS: Handle with care. Call before dispatch.       │
│ [ QR CODE - POD VERIFICATION ]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. INTEGRATIONS ARCHITECTURE

### 8.1 Priority 1 (MVP Foundation)
- **Safaricom Daraja API:**
  - `LipanaMpesaOnline` (STK Push) for instant rider-prompted customer payment.
  - `C2B Validation & Confirmation Webhooks` for direct Paybill settlement matching.
  - `B2C Payout API` for merchant disbursement automation.
- **Transactional Messaging (SMS & WhatsApp Business API):**
  - Instant dispatch SMS to customer with driver name, phone, and direct tracking link.
  - Automated WhatsApp verification ping for newly ingested COD orders.

### 8.2 Priority 2 (Phase 2 Integrations)
- **Shopify & WooCommerce Webhooks:** Real-time bi-directional order sync and inventory level deduction.
- **Third-Party Courier Partner APIs:** Out-of-zone / upcountry forwarding via Fargo Courier, G4S, or Easy Coach parcels.

---

## 9. IMPLEMENTATION ROADMAP (16-WEEK SPRINTS)

```text
WEEKS 1–4: Core Foundation & WMS
├── Project setup: Turborepo / NestJS / PostgreSQL / Redis
├── Multi-tenant merchant isolation & granular RBAC permissions
├── Warehouse location hierarchy & SKU catalog
├── Inbound ASN workflow, barcode generation & GRN issuance
└── Append-only Inventory Ledger with reservation logic

WEEKS 5–8: Orders & Internal Operations
├── Manual order desk & high-speed CSV bulk upload engine
├── Customer Care pre-dispatch COD verification queue
├── Single-order & wave picking logic with barcode scanning
├── Packing verification station & 4x6 thermal PDF waybill generation
└── Dispatch staging, route manifest builder & custody handover validation

WEEKS 9–12: Last-Mile Delivery, COD & Financial Clearing
├── Responsive Rider PWA (camera scanning, offline cache, stop list)
├── Delivery execution (Signature/Photo POD, NDR failure reason logging)
├── Safaricom Daraja integration (STK Push & C2B Webhook matching)
├── End-of-day rider cash reconciliation with variance lock
├── Automated Merchant Ledger calculations (storage, pick/pack, delivery fees)
└── Merchant settlement disbursement approval pipeline

WEEKS 13–16: Merchant Portal, Public Website & Live Pilot
├── Modern Merchant Self-Service Portal (analytics, stock, orders, payouts)
├── High-converting Public Website (services, pricing calculator, lead gen)
├── Production deployment on secure cloud infrastructure
└── Pilot Onboarding: 2–3 active Kenyan e-commerce merchants running live orders
```

---

## 10. CRITICAL MVP ACCEPTANCE CRITERIA

Before opening the platform to public scale, the system must pass this continuous end-to-end operational test with zero human manual database interventions:

1. **Merchant Inbound:** Merchant logs into portal, creates an ASN for 200 items, warehouse receives goods, records 2 damaged items, issues a GRN for 198 items, and puts away into designated bins.
2. **Order Intake & Verification:** Merchant uploads 10 orders via CSV. Customer Care flags 3 as unverified COD, calls them, confirms 2, cancels 1 fake order without wasting packaging or rider time.
3. **Fulfillment:** Warehouse receives pick list, scans bins and barcodes, verifies weights on packing scale, and prints 4x6 thermal waybills.
4. **Dispatch:** Parcels scanned into manifest. Wrong-route test parcel correctly blocked with an error sound. Rider signs for manifest and departs.
5. **Execution & NDR:** Rider delivers 8 orders via M-Pesa STK push. 1 order fails (unreachable); real-time NDR triggers immediate Customer Care callback.
6. **Reconciliation & Settlement:** Rider returns, submits physical cash and M-Pesa receipts. System confirms zero variance and closes shift. Merchant ledger correctly credits COD, deducts fulfillment fees, and generates an approved settlement payout report.

### 10.1 Acceptance test batch 1
An opt-in API acceptance journey is available at `services/api/test/acceptance/operations-flow.test.ts`. It exercises merchant provisioning, ASN receipt and GRN, inventory quantities, CSV order import, order verification/cancellation, pick-wave scans, wrong-route rejection, manifest handover, rider delivery/NDR-to-RTO, cash reconciliation, tracking, and merchant settlement approval/payment.

Run it against a **disposable local acceptance database** with the API and Redis running and a seeded `SUPER_ADMIN` account:

```text
SHIPIT_ACCEPTANCE_API_URL=http://localhost:4000
SHIPIT_ACCEPTANCE_ADMIN_EMAIL=<seeded-admin-email>
SHIPIT_ACCEPTANCE_ADMIN_PASSWORD=<seeded-admin-password>
SHIPIT_ACCEPTANCE_CONFIRM_DATA_WRITES=YES
npm run test:acceptance --workspace=@shipit/api
```

The test creates persistent merchant, rider, order, inventory, and finance records; it does not clean them up. It rejects non-local API URLs unless `SHIPIT_ACCEPTANCE_ALLOW_REMOTE=true` is explicitly set. Only use that override with a dedicated, disposable staging environment. This first batch verifies the cash-COD flow and does not call Safaricom; Daraja callback and payout sandbox testing remains a separate batch.

### 10.2 Rider PWA offline batch 2
The rider PWA caches its app shell and last successfully loaded stop list, and stores offline cash/prepaid POD submissions with captured signature, parcel photo, and optional GPS in browser IndexedDB. Saved PODs are scoped to the signed-in rider account and sync in order when connectivity returns. A database-backed submission ID makes retries idempotent. M-Pesa STK prompts and failed-attempt reports remain online-only; the device must stay available until queued PODs sync. Apply migration `0010_pod_submission_id` before deploying the API and regenerate the Prisma client. Local browser storage is not encrypted, so only use offline mode on managed, screen-locked devices.

### 10.3 Payment callback contract batch 3
`services/api/test/mpesaCallbacks.test.ts` exercises representative STK, C2B, and B2C callback payloads plus exact C2B replay matching. Repeated C2B receipts are acknowledged only when the order, merchant, payment method, and amount all match the original transaction. These unit tests make no Safaricom calls; live/sandbox callback delivery and payout execution still require Daraja sandbox credentials, configured callback URLs, and a disposable test account.

### 10.4 Pilot readiness gate
**Current decision: NO-GO for a live merchant pilot.** The code checks completed in this batch are not substitutes for operating the system against deployed dependencies.

| Gate | Current evidence | Required before go-live |
|---|---|---|
| Build and code checks | API typecheck/build and 10 API tests pass; rider PWA builds | Keep these checks green in the release pipeline |
| Rider offline shell | Production preview reloads while offline | Verify sign-in session, cached stop freshness, queued POD capture, reconnect sync, and duplicate retry on a managed HTTPS device |
| Database and migrations | Prisma schema validates; migration `0010_pod_submission_id` is present | Take a backup, deploy all migrations, verify restore, then run the write-enabled acceptance journey against a disposable seeded environment |
| Payment provider | STK/C2B/B2C callback shape and C2B replay unit tests pass | Execute sandbox STK collection, C2B confirmation, B2C success/failure/timeout and callback retry against Safaricom Daraja |
| Variance approval | Code path and role wiring are present | Verify seeded Operations Manager and Super Admin approve a pending variance; confirm ordinary finance users cannot approve |
| Production operations | `docker/compose.yml` is a development stack (dev commands, source mounts, and local fallback credentials) | Choose a hosting target and provide production images, TLS/reverse proxy, secret management, restricted network exposure, monitoring/alerts, and tested backup/rollback procedures |

The live acceptance journey was safely skipped in this development environment because no acceptance API URL was configured; Docker is also unavailable here. The repository currently has no production deployment stack, so do not expose the development Compose stack or treat this gate as cleared. Revisit this table with deployment and sandbox evidence before onboarding merchants.

---
*Ship It — Engineering & Operations Team | Master Blueprint v1.0*
