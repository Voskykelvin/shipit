// Ship It — Unified Shared Types & Contracts
// Based on Master Blueprint v1.0

// ==========================================
// 1. RBAC & TENANCY
// ==========================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'WAREHOUSE_SUPERVISOR'
  | 'WAREHOUSE_PICKER'
  | 'CUSTOMER_CARE_AGENT'
  | 'DISPATCHER'
  | 'RIDER'
  | 'FINANCE_OFFICER'
  | 'MERCHANT_ADMIN'
  | 'MERCHANT_STAFF';

export type PermissionSlug =
  | 'control_tower.view'
  | 'exception.manage'
  | 'order.view'
  | 'order.manage'
  | 'inventory.view'
  | 'inventory.locations.view'
  | 'inbound.create'
  | 'product.manage'
  | 'inventory.receive'
  | 'inventory.pick'
  | 'inventory.pack'
  | 'inventory.adjust'
  | 'order.create'
  | 'order.verify'
  | 'order.cancel'
  | 'dispatch.manifest'
  | 'dispatch.scan'
  | 'dispatch.view'
  | 'dispatch.handover'
  | 'rider.view'
  | 'rider.manage'
  | 'delivery.tasks'
  | 'delivery.execute'
  | 'ndr.view'
  | 'ndr.resolve'
  | 'finance.view'
  | 'finance.reconcile'
  | 'settlement.approve'
  | 'settlement.create'
  | 'settlement.disburse'
  | 'merchant.manage'
  | 'audit.view';

export interface User {
  id: string;
  merchantId?: string | null; // null for internal staff
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: PermissionSlug[];
  isActive: boolean;
  createdAt: string;
}

export type MerchantStatus = 'ACTIVE' | 'SUSPENDED' | 'ONBOARDING';

export interface RateCard {
  id: string;
  name: string;
  storagePerBinDayKes: number;
  pickPackBaseFeeKes: number;
  deliveryIntraNairobiKes: number;
  deliveryUpcountryKes: number;
  codCommissionPercent: number;
  codCommissionMinKes: number;
  rtoReturnFeeKes: number;
}

export interface Merchant {
  id: string;
  code: string; // e.g. "GLOW"
  name: string;
  contactEmail: string;
  contactPhone: string;
  status: MerchantStatus;
  rateCardId: string;
  mpesaB2cPhone?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    branchName?: string;
  };
  createdAt: string;
}

// ==========================================
// 2. KENYAN ADDRESS ENGINE
// ==========================================

export interface KenyaAddress {
  county: string; // e.g. "Nairobi"
  townOrSubCounty: string; // e.g. "Westlands"
  estateOrArea: string; // e.g. "Rhapta Road / Parkview"
  buildingOrCourt?: string; // e.g. "Heights Apartment B4"
  landmark: string; // e.g. "Opposite Shell Petrol Station, Pink Gate"
  gpsLatitude?: number;
  gpsLongitude?: number;
  googleMapsUrl?: string;
  whatsappLocationText?: string;
}

// ==========================================
// 3. WAREHOUSE & INVENTORY
// ==========================================

export type StorageZone = 'FAST_PICK' | 'BULK' | 'QUARANTINE' | 'RETURNS';

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  zone: StorageZone;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  barcode: string; // e.g. "W1-A02-R03-S1-B04"
  maxWeightKg?: number;
  isOccupied: boolean;
}

export interface Product {
  id: string;
  merchantId: string;
  sku: string;
  barcode: string;
  name: string;
  declaredValueKes: number;
  weightKg: number;
  reorderThreshold: number;
  isFragile: boolean;
  createdAt: string;
}

export type InboundStatus = 'EXPECTED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';

export interface InboundItem {
  id: string;
  productId: string;
  expectedUnits: number;
  receivedUnits: number;
  damagedUnits: number;
  locationId?: string;
}

export interface InboundShipmentASN {
  id: string;
  merchantId: string;
  warehouseId: string;
  asnNumber: string; // e.g. "ASN-00192"
  status: InboundStatus;
  expectedDeliveryDate: string;
  items: InboundItem[];
  grnNumber?: string;
  notes?: string;
  createdAt: string;
}

export type InventoryTransactionType =
  | 'ASN_RECEIVE'
  | 'ORDER_RESERVE'
  | 'ORDER_PICK'
  | 'ORDER_CANCEL_RELEASE'
  | 'RETURN_RESTOCK'
  | 'RETURN_DAMAGED'
  | 'SUPERVISOR_ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  productId: string;
  locationId: string;
  type: InventoryTransactionType;
  referenceId: string; // orderId, asnId, returnId
  deltaAvailable: number;
  deltaReserved: number;
  deltaDamaged: number;
  deltaQuarantine: number;
  performedByUserId: string;
  supervisorApprovedBy?: string;
  reasonCode: string;
  createdAt: string;
}

export interface InventoryStockSummary {
  productId: string;
  sku: string;
  productName: string;
  merchantId: string;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  quarantineQty: number;
  totalPhysicalQty: number;
}

// ==========================================
// 4. ORDERS & FULFILLMENT PIPELINE
// ==========================================

export type OrderStatus =
  | 'PENDING_VERIFICATION'
  | 'CONFIRMED'
  | 'READY_FOR_PICK'
  | 'PICKING'
  | 'PACKED'
  | 'MANIFESTED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'NDR_EXCEPTION'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED_TO_WAREHOUSE'
  | 'CANCELLED';

export type PaymentMethod = 'COD_MPESA' | 'COD_CASH' | 'PREPAID';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceKes: number;
  allocatedLocationId?: string;
}

export interface Order {
  id: string;
  merchantId: string;
  orderNumber: string; // e.g. "ORD-2026-90412"
  externalReference?: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  address: KenyaAddress;
  items: OrderItem[];
  orderValueKes: number;
  deliveryFeeKes: number;
  codAmountExpectedKes: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  preferredDeliveryDate?: string;
  verificationNotes?: string;
  verifiedByUserId?: string;
  verifiedAt?: string;
  waybillNumber?: string;
  manifestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Waybill {
  id: string;
  orderId: string;
  trackingNumber: string; // "WB-98234-KE"
  barcodeCode128: string;
  qrPayload: string;
  merchantName: string;
  recipientName: string;
  maskedPhone: string;
  destinationRoute: string;
  codAmountKes: number;
  weightKg: number;
  packageItemCount: number;
  generatedAt: string;
}

// ==========================================
// 5. DISPATCH, ROUTES & RIDERS
// ==========================================

export interface DeliveryRoute {
  id: string;
  routeCode: string; // "NBO-WESTLANDS-01"
  name: string;
  areasCovered: string[];
  isActive: boolean;
}

export interface Rider {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  vehiclePlate: string;
  nationalId: string;
  activeRouteId?: string;
  isOnDuty: boolean;
}

export type ManifestStatus = 'STAGED' | 'DISPATCHED' | 'IN_TRANSIT' | 'CLOSED';

export interface DispatchManifest {
  id: string;
  manifestNumber: string; // "MNF-2026-0881"
  routeId: string;
  routeCode: string;
  riderId: string;
  riderName: string;
  status: ManifestStatus;
  parcels: string[]; // Order IDs / Waybills
  totalParcels: number;
  expectedCodTotalKes: number;
  dispatchedAt?: string;
  closedAt?: string;
  createdAt: string;
}

// ==========================================
// 6. DELIVERY ATTEMPTS, NDR & PROOF OF DELIVERY
// ==========================================

export type NDRReason =
  | 'CUSTOMER_UNREACHABLE'
  | 'WRONG_LOCATION'
  | 'RESCHEDULE_REQUESTED'
  | 'REFUSED_DELIVERY'
  | 'CASH_SHORTAGE'
  | 'WRONG_ITEMS';

export interface DeliveryAttempt {
  id: string;
  orderId: string;
  manifestId: string;
  riderId: string;
  attemptNumber: number;
  status: 'SUCCESS' | 'FAILED';
  failureReason?: NDRReason;
  rescheduleDate?: string;
  notes?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  timestamp: string;
}

export interface ProofOfDelivery {
  id: string;
  orderId: string;
  riderId: string;
  recipientName: string;
  signatureUrl?: string;
  photoUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
  paymentChannel: 'MPESA_STK' | 'MPESA_C2B' | 'CASH' | 'PREPAID';
  mpesaReceiptNumber?: string;
  amountCollectedKes: number;
  deliveredTimestamp: string;
}

export type NDRCaseStatus = 'OPEN' | 'CALLING' | 'RESOLVED_RETRY' | 'RESOLVED_RTO';

export interface NDRCase {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  area: string;
  riderName: string;
  failureReason: NDRReason;
  status: NDRCaseStatus;
  actionTakenNotes?: string;
  createdAt: string;
}

// ==========================================
// 7. COD CLEARING & FINANCE
// ==========================================

export interface CODTransaction {
  id: string;
  orderId: string;
  merchantId: string;
  riderId: string;
  channel: 'MPESA_STK' | 'MPESA_C2B' | 'CASH';
  amountCollectedKes: number;
  mpesaReceiptNumber?: string;
  isReconciled: boolean;
  collectedAt: string;
}

export interface RiderShiftReconciliation {
  id: string;
  riderId: string;
  riderName: string;
  shiftDate: string;
  expectedCodKes: number;
  mpesaCollectedKes: number;
  expectedCashKes: number;
  cashHandedInKes: number;
  varianceKes: number; // cashHandedIn - expectedCash
  isReconciled: boolean;
  supervisorApprovedBy?: string;
  varianceNotes?: string;
  closedAt?: string;
}

export type LedgerType =
  | 'COD_CREDIT'
  | 'FULFILLMENT_FEE_DEBIT'
  | 'STORAGE_FEE_DEBIT'
  | 'DELIVERY_FEE_DEBIT'
  | 'COD_COMMISSION_DEBIT'
  | 'RETURN_FEE_DEBIT'
  | 'SETTLEMENT_PAYOUT_DEBIT'
  | 'ADJUSTMENT'
  | 'MANUAL_ADJUSTMENT';

export interface MerchantLedgerEntry {
  id: string;
  merchantId: string;
  orderId?: string;
  type: LedgerType;
  amountKes: number; // positive = credit to merchant, negative = debit
  runningBalanceKes: number;
  description: string;
  createdAt: string;
}

export type SettlementStatus = 'DRAFT' | 'APPROVED' | 'DISBURSED' | 'FAILED';

export interface MerchantSettlement {
  id: string;
  settlementNumber: string; // "SET-2026-0042"
  merchantId: string;
  grossCodCollectedKes: number;
  totalFeesDeductedKes: number;
  netPayoutKes: number;
  status: SettlementStatus;
  payoutReference?: string;
  approvedByUserId?: string;
  disbursedAt?: string;
  createdAt: string;
}

// ==========================================
// 8. EXCEPTIONS & AUDIT LOGS
// ==========================================

export type ExceptionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type ExceptionCategory =
  | 'COD_VARIANCE'
  | 'ROUTE_MISMATCH'
  | 'STOCK_SHORTAGE'
  | 'FAILED_DELIVERY'
  | 'CUSTOMER_UNREACHABLE'
  | 'SETTLEMENT_BLOCKED';

export interface SystemException {
  id: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  details: string;
  entityId: string;
  entityType: 'ORDER' | 'RIDER_SHIFT' | 'INVENTORY' | 'MANIFEST' | 'SETTLEMENT';
  isResolved: boolean;
  resolvedByUserId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}
