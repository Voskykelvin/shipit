CREATE TYPE "MpesaStkRequestStatus" AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED');

ALTER TABLE "CODTransaction" ALTER COLUMN "riderId" DROP NOT NULL;

CREATE TABLE "MpesaStkRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amountKes" INTEGER NOT NULL,
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "status" "MpesaStkRequestStatus" NOT NULL DEFAULT 'INITIATED',
    "resultCode" INTEGER,
    "resultDescription" TEXT,
    "mpesaReceiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "MpesaStkRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MpesaStkRequest_checkoutRequestId_key" ON "MpesaStkRequest"("checkoutRequestId");
CREATE INDEX "MpesaStkRequest_orderId_status_createdAt_idx" ON "MpesaStkRequest"("orderId", "status", "createdAt");

ALTER TABLE "MpesaStkRequest" ADD CONSTRAINT "MpesaStkRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MpesaStkRequest" ADD CONSTRAINT "MpesaStkRequest_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MpesaStkRequest" ADD CONSTRAINT "MpesaStkRequest_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;