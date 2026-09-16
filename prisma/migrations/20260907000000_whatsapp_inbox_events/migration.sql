-- Durable WhatsApp webhook inbox. The unique message id makes duplicate
-- delivery safe even when Redis is unavailable or its short TTL has expired.
CREATE TABLE "WhatsAppInboundEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "messageType" TEXT NOT NULL,
    "body" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInboundEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppInboundEvent_messageId_key"
  ON "WhatsAppInboundEvent"("messageId");

CREATE INDEX "WhatsAppInboundEvent_phone_receivedAt_idx"
  ON "WhatsAppInboundEvent"("phone", "receivedAt");

CREATE INDEX "WhatsAppInboundEvent_phoneNumberId_receivedAt_idx"
  ON "WhatsAppInboundEvent"("phoneNumberId", "receivedAt");
