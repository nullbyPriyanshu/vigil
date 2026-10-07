-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "nextEscalationAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Incident_status_nextEscalationAt_idx" ON "Incident"("status", "nextEscalationAt");

