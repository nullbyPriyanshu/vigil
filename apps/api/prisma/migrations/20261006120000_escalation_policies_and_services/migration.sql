-- CreateEnum
CREATE TYPE "EscalationTargetType" AS ENUM ('USER', 'TEAM', 'SCHEDULE');

-- CreateTable
CREATE TABLE "EscalationPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repeatCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationStep" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "targetType" "EscalationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,

    CONSTRAINT "EscalationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "autoResolveMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "escalationPolicyId" TEXT NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalationPolicy_organizationId_name_key" ON "EscalationPolicy"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationStep_policyId_position_key" ON "EscalationStep"("policyId", "position");

-- CreateIndex
CREATE INDEX "Service_teamId_idx" ON "Service"("teamId");

-- CreateIndex
CREATE INDEX "Service_escalationPolicyId_idx" ON "Service"("escalationPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_organizationId_name_key" ON "Service"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationStep" ADD CONSTRAINT "EscalationStep_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "EscalationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_escalationPolicyId_fkey" FOREIGN KEY ("escalationPolicyId") REFERENCES "EscalationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

