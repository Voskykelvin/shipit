ALTER TABLE "ProofOfDelivery"
ADD COLUMN "clientSubmissionId" TEXT;

CREATE UNIQUE INDEX "ProofOfDelivery_clientSubmissionId_key"
ON "ProofOfDelivery"("clientSubmissionId");
