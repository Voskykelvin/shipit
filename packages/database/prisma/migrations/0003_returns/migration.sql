CREATE TYPE "ReturnType" AS ENUM ('IMMEDIATE_RTO', 'CUSTOMER_POST_DELIVERY_RETURN');
CREATE TYPE "ReturnStatus" AS ENUM ('RETURN_INITIATED', 'IN_TRANSIT', 'RECEIVED_AT_WAREHOUSE', 'INSPECTED');
CREATE TYPE "ReturnConditionGrade" AS ENUM ('GRADE_A_RESTOCKABLE', 'GRADE_B_DAMAGED_PACKAGING', 'GRADE_C_DAMAGED_PRODUCT', 'WRONG_ITEM_RETURNED');
CREATE TYPE "ReturnInspectionAction" AS ENUM ('RESTOCKED_TO_AVAILABLE', 'QUARANTINED', 'RETURNED_TO_MERCHANT');

CREATE TABLE "ReturnRecord" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "returnType" "ReturnType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'RETURN_INITIATED',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    CONSTRAINT "ReturnRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedUnits" INTEGER NOT NULL,
    "inspectedUnits" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnInspection" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "inspectedByUserId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "conditionGrade" "ReturnConditionGrade" NOT NULL,
    "action" "ReturnInspectionAction" NOT NULL,
    "photos" JSONB,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnInspection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnRecord_returnNumber_key" ON "ReturnRecord"("returnNumber");
CREATE INDEX "ReturnRecord_merchantId_status_initiatedAt_idx" ON "ReturnRecord"("merchantId", "status", "initiatedAt");
CREATE INDEX "ReturnRecord_orderId_initiatedAt_idx" ON "ReturnRecord"("orderId", "initiatedAt");
CREATE UNIQUE INDEX "ReturnItem_returnId_productId_key" ON "ReturnItem"("returnId", "productId");
CREATE INDEX "ReturnItem_productId_idx" ON "ReturnItem"("productId");
CREATE INDEX "ReturnInspection_returnItemId_inspectedAt_idx" ON "ReturnInspection"("returnItemId", "inspectedAt");

ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_inspectedByUserId_fkey" FOREIGN KEY ("inspectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;