-- Merchant acquisition: prospects remain separate from real Vendor accounts.

CREATE TYPE "AcquisitionSource" AS ENUM (
  'GOOGLE_BUSINESS', 'SOCIAL_MEDIA', 'AMBASSADOR_REFERRAL', 'DIRECT_OUTBOUND',
  'EVENT_COMMUNITY', 'PARTNERSHIP', 'MANUAL_ENTRY', 'OTHER'
);
CREATE TYPE "AcquisitionBusinessSize" AS ENUM ('SOLO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN');
CREATE TYPE "AcquisitionTransactionVolumeBand" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'UNKNOWN');
CREATE TYPE "AcquisitionCreditBehavior" AS ENUM ('NONE', 'PAPER_LEDGER', 'SPREADSHEET', 'WHATSAPP', 'DIGITAL_TOOL', 'UNKNOWN');
CREATE TYPE "AcquisitionWhatsAppUsage" AS ENUM ('ACTIVE_PERSONAL', 'WHATSAPP_BUSINESS', 'LIMITED', 'NONE', 'UNKNOWN');
CREATE TYPE "AcquisitionFit" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNQUALIFIED');
CREATE TYPE "AcquisitionStage" AS ENUM (
  'IDENTIFIED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'DEMO_SCHEDULED',
  'DEMO_COMPLETED', 'ONBOARDING', 'ACTIVATED', 'WON', 'LOST', 'UNQUALIFIED'
);
CREATE TYPE "AcquisitionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "AcquisitionNextActionType" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'DEMO', 'VISIT', 'RESEARCH', 'OTHER');
CREATE TYPE "AcquisitionActivityType" AS ENUM (
  'NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'DEMO',
  'STATUS_CHANGE', 'FOLLOW_UP_COMPLETED', 'SYSTEM_SYNC'
);
CREATE TYPE "AcquisitionCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

CREATE TABLE "AcquisitionCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "source" "AcquisitionSource" NOT NULL,
  "status" "AcquisitionCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "ownerAdminId" TEXT,
  "budgetAmount" DECIMAL(12,2),
  "actualSpendAmount" DECIMAL(12,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcquisitionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcquisitionProspect" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "vendorType" "VendorType",
  "communityId" TEXT,
  "locationText" TEXT,
  "city" TEXT,
  "state" TEXT,
  "businessSize" "AcquisitionBusinessSize" NOT NULL DEFAULT 'UNKNOWN',
  "transactionVolumeBand" "AcquisitionTransactionVolumeBand" NOT NULL DEFAULT 'UNKNOWN',
  "creditBehavior" "AcquisitionCreditBehavior" NOT NULL DEFAULT 'UNKNOWN',
  "whatsAppUsage" "AcquisitionWhatsAppUsage" NOT NULL DEFAULT 'UNKNOWN',
  "fit" "AcquisitionFit" NOT NULL DEFAULT 'MEDIUM',
  "fitNotes" TEXT,
  "source" "AcquisitionSource" NOT NULL,
  "sourceDetail" TEXT,
  "campaignId" TEXT,
  "ambassadorId" TEXT,
  "capturedByAdminId" TEXT,
  "assignedToAdminId" TEXT,
  "stage" "AcquisitionStage" NOT NULL DEFAULT 'IDENTIFIED',
  "priority" "AcquisitionPriority" NOT NULL DEFAULT 'NORMAL',
  "nextActionType" "AcquisitionNextActionType",
  "nextActionAt" TIMESTAMP(3),
  "nextActionNote" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "contactAttempts" INTEGER NOT NULL DEFAULT 0,
  "lossReason" TEXT,
  "unqualifiedReason" TEXT,
  "convertedVendorId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contactedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "qualifiedAt" TIMESTAMP(3),
  "demoScheduledAt" TIMESTAMP(3),
  "demoCompletedAt" TIMESTAMP(3),
  "onboardingStartedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcquisitionProspect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcquisitionActivity" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "type" "AcquisitionActivityType" NOT NULL,
  "outcome" TEXT,
  "body" TEXT,
  "stageFrom" "AcquisitionStage",
  "stageTo" "AcquisitionStage",
  "nextActionAt" TIMESTAMP(3),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcquisitionProspect_convertedVendorId_key" ON "AcquisitionProspect"("convertedVendorId");
CREATE INDEX "AcquisitionProspect_stage_idx" ON "AcquisitionProspect"("stage");
CREATE INDEX "AcquisitionProspect_assignedToAdminId_nextActionAt_idx" ON "AcquisitionProspect"("assignedToAdminId", "nextActionAt");
CREATE INDEX "AcquisitionProspect_source_idx" ON "AcquisitionProspect"("source");
CREATE INDEX "AcquisitionProspect_campaignId_idx" ON "AcquisitionProspect"("campaignId");
CREATE INDEX "AcquisitionProspect_ambassadorId_idx" ON "AcquisitionProspect"("ambassadorId");
CREATE INDEX "AcquisitionProspect_communityId_idx" ON "AcquisitionProspect"("communityId");
CREATE INDEX "AcquisitionProspect_phone_idx" ON "AcquisitionProspect"("phone");
CREATE INDEX "AcquisitionProspect_email_idx" ON "AcquisitionProspect"("email");
CREATE INDEX "AcquisitionProspect_createdAt_idx" ON "AcquisitionProspect"("createdAt");
CREATE INDEX "AcquisitionActivity_prospectId_occurredAt_idx" ON "AcquisitionActivity"("prospectId", "occurredAt");
CREATE INDEX "AcquisitionActivity_createdByAdminId_idx" ON "AcquisitionActivity"("createdByAdminId");
CREATE INDEX "AcquisitionActivity_type_idx" ON "AcquisitionActivity"("type");
CREATE INDEX "AcquisitionCampaign_status_idx" ON "AcquisitionCampaign"("status");
CREATE INDEX "AcquisitionCampaign_source_idx" ON "AcquisitionCampaign"("source");
CREATE INDEX "AcquisitionCampaign_ownerAdminId_idx" ON "AcquisitionCampaign"("ownerAdminId");
CREATE INDEX "AcquisitionCampaign_startAt_idx" ON "AcquisitionCampaign"("startAt");

ALTER TABLE "AcquisitionCampaign" ADD CONSTRAINT "AcquisitionCampaign_ownerAdminId_fkey"
  FOREIGN KEY ("ownerAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AcquisitionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_ambassadorId_fkey"
  FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_capturedByAdminId_fkey"
  FOREIGN KEY ("capturedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_assignedToAdminId_fkey"
  FOREIGN KEY ("assignedToAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionProspect" ADD CONSTRAINT "AcquisitionProspect_convertedVendorId_fkey"
  FOREIGN KEY ("convertedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionActivity" ADD CONSTRAINT "AcquisitionActivity_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "AcquisitionProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcquisitionActivity" ADD CONSTRAINT "AcquisitionActivity_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
