CREATE TYPE "MpesaB2CPayoutStatus" AS ENUM ('INITIATED', 'ACCEPTED', 'SUCCEEDED', 'FAILED');

CREATE TABLE "MpesaB2CPayout" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "conversationId" TEXT,
    "originatorConversationId" TEXT,
    "status" "MpesaB2CPayoutStatus" NOT NULL DEFAULT 'INITIATED',
    "resultCode" INTEGER,
    "resultDescription" TEXT,
    "payoutReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "MpesaB2CPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MpesaB2CPayout_settlementId_key" ON "MpesaB2CPayout"("settlementId");
CREATE UNIQUE INDEX "MpesaB2CPayout_conversationId_key" ON "MpesaB2CPayout"("conversationId");
CREATE UNIQUE INDEX "MpesaB2CPayout_originatorConversationId_key" ON "MpesaB2CPayout"("originatorConversationId");
ALTER TABLE "MpesaB2CPayout" ADD CONSTRAINT "MpesaB2CPayout_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "MerchantSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;