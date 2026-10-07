-- AlterEnum
ALTER TYPE "IncidentEventType" ADD VALUE 'AUTO_RESOLVED';

-- AlterTable
ALTER TABLE "Incident" ALTER COLUMN "currentStepPosition" SET DEFAULT 0;

