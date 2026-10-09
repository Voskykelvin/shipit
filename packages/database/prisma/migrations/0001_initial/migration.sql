-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('ASN_RECEIVE', 'ORDER_RESERVE', 'ORDER_PICK', 'ORDER_CANCEL_RELEASE', 'RETURN_RESTOCK', 'RETURN_DAMAGED', 'SUPERVISOR_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('EXPECTED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_VERIFICATION', 'CONFIRMED', 'READY_FOR_PICK', 'PICKING', 'PACKED', 'MANIFESTED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NDR_EXCEPTION', 'RETURN_IN_TRANSIT', 'RETURNED_TO_WAREHOUSE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD_MPESA', 'COD_CASH', 'PREPAID');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('STAGED', 'ACCEPTED_BY_RIDER', 'IN_TRANSIT', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('OFF_DUTY', 'ON_DUTY', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_UNREACHABLE', 'WRONG_LOCATION', 'RESCHEDULE_REQUESTED', 'REFUSED_DELIVERY', 'CASH_SHORTAGE');

-- CreateEnum
CREATE TYPE "NdrStatus" AS ENUM ('OPEN', 'ESCALATED', 'RESOLVED_FOR_REDELIVERY', 'RESOLVED_FOR_RTO');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('MPESA_STK', 'MPESA_C2B', 'CASH', 'PREPAID');

-- CreateEnum
CREATE TYPE "CodStatus" AS ENUM ('PENDING_SETTLEMENT', 'RECONCILED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('COD_CREDIT', 'FULFILLMENT_FEE_DEBIT', 'STORAGE_FEE_DEBIT', 'DELIVERY_FEE_DEBIT', 'COD_COMMISSION_DEBIT', 'RETURN_PENALTY_DEBIT', 'SETTLEMENT_PAYOUT_DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSED', 'PAID');

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ONBOARDING',
    "rateCardId" TEXT,
    "mpesaB2cPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storagePerBinDayKes" INTEGER NOT NULL DEFAULT 0,
    "pickPackBaseFeeKes" INTEGER NOT NULL DEFAULT 0,
    "deliveryIntraNairobiKes" INTEGER NOT NULL DEFAULT 0,
    "deliveryUpcountryKes" INTEGER NOT NULL DEFAULT 0,
    "codCommissionBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "codCommissionMinKes" INTEGER NOT NULL DEFAULT 0,
    "rtoReturnFeeKes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ONBOARDING',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "rack" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "maxWeightKg" DECIMAL(10,3),
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "declaredValueKes" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "requiresColdStorage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundShipment" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "asnNumber" TEXT NOT NULL,
    "status" "InboundStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "grnNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundItem" (
    "id" TEXT NOT NULL,
    "inboundShipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedUnits" INTEGER NOT NULL,
    "receivedUnits" INTEGER NOT NULL DEFAULT 0,
    "damagedUnits" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,

    CONSTRAINT "InboundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "quarantineQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "deltaAvailable" INTEGER NOT NULL DEFAULT 0,
    "deltaReserved" INTEGER NOT NULL DEFAULT 0,
    "deltaDamaged" INTEGER NOT NULL DEFAULT 0,
    "deltaQuarantine" INTEGER NOT NULL DEFAULT 0,
    "performedByUserId" TEXT,
    "supervisorApprovedBy" TEXT,
    "reasonCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "externalReference" TEXT,
    "orderSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerAltPhone" TEXT,
    "county" TEXT NOT NULL,
    "townOrSubCounty" TEXT NOT NULL,
    "estateOrArea" TEXT NOT NULL,
    "buildingOrCourt" TEXT,
    "landmark" TEXT NOT NULL,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "googleMapsUrl" TEXT,
    "orderValueKes" INTEGER NOT NULL,
    "deliveryFeeKes" INTEGER NOT NULL,
    "codAmountExpectedKes" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationNotes" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "preferredDeliveryDate" TIMESTAMP(3),
    "waybillNumber" TEXT,
    "manifestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKes" INTEGER NOT NULL,
    "allocatedLocationId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pickedQuantity" INTEGER NOT NULL DEFAULT 0,
    "scannedBarcode" TEXT,
    "pickedAt" TIMESTAMP(3),
    "pickedByUserId" TEXT,

    CONSTRAINT "OrderAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRoute" (
    "id" TEXT NOT NULL,
    "routeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subCountiesServed" TEXT[],

    CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nationalIdNumber" TEXT,
    "vehicleRegPlate" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "activeStatus" "RiderStatus" NOT NULL DEFAULT 'OFF_DUTY',
    "currentCashHeldKes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchManifest" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'STAGED',
    "totalParcels" INTEGER NOT NULL DEFAULT 0,
    "expectedCodTotalKes" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waybill" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "barcodeCode128" TEXT NOT NULL,
    "qrCodePayload" TEXT NOT NULL,
    "labelPdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waybill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "DeliveryAttemptStatus" NOT NULL,
    "failureReason" "DeliveryFailureReason",
    "rescheduleDate" TIMESTAMP(3),
    "riderNotes" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "attemptTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "signatureImageUrl" TEXT,
    "parcelPhotoUrl" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NDRCase" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryAttemptId" TEXT NOT NULL,
    "status" "NdrStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAgentId" TEXT,
    "actionTaken" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "NDRCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CODTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "paymentChannel" "PaymentChannel" NOT NULL,
    "amountCollectedKes" INTEGER NOT NULL,
    "mpesaReceiptNumber" TEXT,
    "status" "CodStatus" NOT NULL DEFAULT 'PENDING_SETTLEMENT',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CODTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderShift" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "shiftDate" DATE NOT NULL,
    "openingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingTimestamp" TIMESTAMP(3),
    "totalCodExpectedKes" INTEGER NOT NULL DEFAULT 0,
    "mpesaCollectedKes" INTEGER NOT NULL DEFAULT 0,
    "cashExpectedKes" INTEGER NOT NULL DEFAULT 0,
    "cashHandedInKes" INTEGER NOT NULL DEFAULT 0,
    "varianceKes" INTEGER NOT NULL DEFAULT 0,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "supervisorApprovedUserId" TEXT,
    "varianceReasonNotes" TEXT,

    CONSTRAINT "RiderShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantLedger" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT,
    "transactionType" "LedgerTransactionType" NOT NULL,
    "amountKes" INTEGER NOT NULL,
    "runningBalanceKes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantSettlement" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossCodKes" INTEGER NOT NULL,
    "deductedFeesKes" INTEGER NOT NULL,
    "netPayoutKes" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "payoutReference" TEXT,
    "approvedByUserId" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLedgerEntry" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,

    CONSTRAINT "SettlementLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "merchantId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforePayload" JSONB,
    "afterPayload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_code_key" ON "Merchant"("code");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "Merchant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RateCard_name_key" ON "RateCard"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_merchantId_status_idx" ON "User"("merchantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_slug_key" ON "Permission"("slug");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_barcode_key" ON "WarehouseLocation"("barcode");

-- CreateIndex
CREATE INDEX "WarehouseLocation_warehouseId_zone_idx" ON "WarehouseLocation"("warehouseId", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_zone_aisle_rack_shelf_bin_key" ON "WarehouseLocation"("warehouseId", "zone", "aisle", "rack", "shelf", "bin");

-- CreateIndex
CREATE INDEX "Product_merchantId_name_idx" ON "Product"("merchantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_merchantId_sku_key" ON "Product"("merchantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_merchantId_barcode_key" ON "Product"("merchantId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "InboundShipment_asnNumber_key" ON "InboundShipment"("asnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InboundShipment_grnNumber_key" ON "InboundShipment"("grnNumber");

-- CreateIndex
CREATE INDEX "InboundShipment_merchantId_status_expectedDeliveryDate_idx" ON "InboundShipment"("merchantId", "status", "expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "InboundItem_productId_idx" ON "InboundItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundItem_inboundShipmentId_productId_key" ON "InboundItem"("inboundShipmentId", "productId");

-- CreateIndex
CREATE INDEX "InventoryLevel_locationId_idx" ON "InventoryLevel"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLevel_productId_locationId_key" ON "InventoryLevel"("productId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_merchantId_createdAt_idx" ON "InventoryTransaction"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_productId_locationId_createdAt_idx" ON "InventoryTransaction"("productId", "locationId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_referenceId_type_idx" ON "InventoryTransaction"("referenceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_waybillNumber_key" ON "Order"("waybillNumber");

-- CreateIndex
CREATE INDEX "Order_merchantId_status_createdAt_idx" ON "Order"("merchantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_merchantId_externalReference_key" ON "Order"("merchantId", "externalReference");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderAllocation_locationId_pickedAt_idx" ON "OrderAllocation"("locationId", "pickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAllocation_orderItemId_locationId_key" ON "OrderAllocation"("orderItemId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRoute_routeCode_key" ON "DeliveryRoute"("routeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_userId_key" ON "Rider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchManifest_manifestNumber_key" ON "DispatchManifest"("manifestNumber");

-- CreateIndex
CREATE INDEX "DispatchManifest_riderId_status_idx" ON "DispatchManifest"("riderId", "status");

-- CreateIndex
CREATE INDEX "DispatchManifest_routeId_createdAt_idx" ON "DispatchManifest"("routeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Waybill_orderId_key" ON "Waybill"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Waybill_trackingNumber_key" ON "Waybill"("trackingNumber");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_riderId_attemptTimestamp_idx" ON "DeliveryAttempt"("riderId", "attemptTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAttempt_orderId_attemptNumber_key" ON "DeliveryAttempt"("orderId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProofOfDelivery_orderId_key" ON "ProofOfDelivery"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "NDRCase_deliveryAttemptId_key" ON "NDRCase"("deliveryAttemptId");

-- CreateIndex
CREATE INDEX "NDRCase_status_createdAt_idx" ON "NDRCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CODTransaction_merchantId_status_collectedAt_idx" ON "CODTransaction"("merchantId", "status", "collectedAt");

-- CreateIndex
CREATE INDEX "CODTransaction_riderId_collectedAt_idx" ON "CODTransaction"("riderId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CODTransaction_paymentChannel_mpesaReceiptNumber_key" ON "CODTransaction"("paymentChannel", "mpesaReceiptNumber");

-- CreateIndex
CREATE INDEX "RiderShift_shiftDate_isReconciled_idx" ON "RiderShift"("shiftDate", "isReconciled");

-- CreateIndex
CREATE UNIQUE INDEX "RiderShift_riderId_shiftDate_key" ON "RiderShift"("riderId", "shiftDate");

-- CreateIndex
CREATE INDEX "MerchantLedger_merchantId_createdAt_idx" ON "MerchantLedger"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettlement_settlementNumber_key" ON "MerchantSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "MerchantSettlement_merchantId_status_createdAt_idx" ON "MerchantSettlement"("merchantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettlement_merchantId_periodStart_periodEnd_key" ON "MerchantSettlement"("merchantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementLedgerEntry_ledgerEntryId_key" ON "SettlementLedgerEntry"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "SettlementLedgerEntry_settlementId_idx" ON "SettlementLedgerEntry"("settlementId");

-- CreateIndex
CREATE INDEX "AuditLog_merchantId_entityType_entityId_createdAt_idx" ON "AuditLog"("merchantId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipment" ADD CONSTRAINT "InboundShipment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundShipment" ADD CONSTRAINT "InboundShipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundItem" ADD CONSTRAINT "InboundItem_inboundShipmentId_fkey" FOREIGN KEY ("inboundShipmentId") REFERENCES "InboundShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundItem" ADD CONSTRAINT "InboundItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundItem" ADD CONSTRAINT "InboundItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_supervisorApprovedBy_fkey" FOREIGN KEY ("supervisorApprovedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DispatchManifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_allocatedLocationId_fkey" FOREIGN KEY ("allocatedLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_pickedByUserId_fkey" FOREIGN KEY ("pickedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchManifest" ADD CONSTRAINT "DispatchManifest_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DeliveryRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchManifest" ADD CONSTRAINT "DispatchManifest_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waybill" ADD CONSTRAINT "Waybill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DispatchManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDRCase" ADD CONSTRAINT "NDRCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDRCase" ADD CONSTRAINT "NDRCase_deliveryAttemptId_fkey" FOREIGN KEY ("deliveryAttemptId") REFERENCES "DeliveryAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CODTransaction" ADD CONSTRAINT "CODTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CODTransaction" ADD CONSTRAINT "CODTransaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CODTransaction" ADD CONSTRAINT "CODTransaction_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderShift" ADD CONSTRAINT "RiderShift_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantLedger" ADD CONSTRAINT "MerchantLedger_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantLedger" ADD CONSTRAINT "MerchantLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantSettlement" ADD CONSTRAINT "MerchantSettlement_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLedgerEntry" ADD CONSTRAINT "SettlementLedgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "MerchantSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLedgerEntry" ADD CONSTRAINT "SettlementLedgerEntry_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "MerchantLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
