CREATE TYPE "PickWaveStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "PickWave" (
    "id" TEXT NOT NULL,
    "waveNumber" TEXT NOT NULL,
    "status" "PickWaveStatus" NOT NULL DEFAULT 'CREATED',
    "assignedToUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PickWave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PickTask" (
    "id" TEXT NOT NULL,
    "pickWaveId" TEXT NOT NULL,
    "orderAllocationId" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "scannedBarcode" TEXT,
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "PickTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickWave_waveNumber_key" ON "PickWave"("waveNumber");
CREATE INDEX "PickWave_status_createdAt_idx" ON "PickWave"("status", "createdAt");
CREATE INDEX "PickWave_assignedToUserId_status_idx" ON "PickWave"("assignedToUserId", "status");
CREATE UNIQUE INDEX "PickTask_pickWaveId_orderAllocationId_key" ON "PickTask"("pickWaveId", "orderAllocationId");
CREATE INDEX "PickTask_pickWaveId_isConfirmed_idx" ON "PickTask"("pickWaveId", "isConfirmed");
CREATE INDEX "PickTask_orderAllocationId_idx" ON "PickTask"("orderAllocationId");

ALTER TABLE "PickWave" ADD CONSTRAINT "PickWave_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_pickWaveId_fkey" FOREIGN KEY ("pickWaveId") REFERENCES "PickWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_orderAllocationId_fkey" FOREIGN KEY ("orderAllocationId") REFERENCES "OrderAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;