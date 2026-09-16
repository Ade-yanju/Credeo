-- Durable outbound WhatsApp delivery log. Provider status webhooks can update
-- rows by providerMessageId; the future outbox worker can use the same table.
CREATE TYPE "WhatsAppDeliveryKind" AS ENUM (
    'TEXT',
    'BUTTONS',
    'LIST',
    'TEMPLATE',
    'DOCUMENT',
    'DOCUMENT_TEMPLATE'
);

CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM (
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED'
);

CREATE TABLE "WhatsAppDelivery" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "kind" "WhatsAppDeliveryKind" NOT NULL,
    "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppDelivery_providerMessageId_key"
  ON "WhatsAppDelivery"("providerMessageId");
CREATE INDEX "WhatsAppDelivery_recipient_createdAt_idx"
  ON "WhatsAppDelivery"("recipient", "createdAt");
CREATE INDEX "WhatsAppDelivery_status_createdAt_idx"
  ON "WhatsAppDelivery"("status", "createdAt");
CREATE INDEX "WhatsAppDelivery_phoneNumberId_createdAt_idx"
  ON "WhatsAppDelivery"("phoneNumberId", "createdAt");
