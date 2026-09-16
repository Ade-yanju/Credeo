-- Durable template-message outbox. Idempotency is enforced before a provider
-- call so a cron retry cannot enqueue the same scheduled message twice.
CREATE TYPE "WhatsAppOutboxKind" AS ENUM ('TEMPLATE', 'DOCUMENT_TEMPLATE');
CREATE TYPE "WhatsAppOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "WhatsAppOutboxMessage" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "organizationId" TEXT,
    "recipient" TEXT NOT NULL,
    "kind" "WhatsAppOutboxKind" NOT NULL,
    "templateName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en_US',
    "bodyParams" JSONB NOT NULL,
    "documentLink" TEXT,
    "filename" TEXT,
    "status" "WhatsAppOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppOutboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppOutboxMessage_idempotencyKey_key"
  ON "WhatsAppOutboxMessage"("idempotencyKey");
CREATE INDEX "WhatsAppOutboxMessage_status_availableAt_idx"
  ON "WhatsAppOutboxMessage"("status", "availableAt");
CREATE INDEX "WhatsAppOutboxMessage_organizationId_createdAt_idx"
  ON "WhatsAppOutboxMessage"("organizationId", "createdAt");
CREATE INDEX "WhatsAppOutboxMessage_recipient_createdAt_idx"
  ON "WhatsAppOutboxMessage"("recipient", "createdAt");
