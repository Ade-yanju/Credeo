-- Voice notes: the language a vendor speaks, asked once and reused on every
-- note. The speech-to-text provider does not detect language — it has to be
-- told which one to assume — so this is stored rather than guessed per message.
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "voiceLanguage" TEXT NOT NULL DEFAULT 'en';

-- Payment receipts read by OCR. One row per receipt a customer sends in.
--
-- Replaces the previous duplicate check, which substring-scanned
-- Notification.message for the transaction reference: unindexed, and not scoped
-- per vendor, so one vendor's receipt could suppress another's.
CREATE TABLE IF NOT EXISTS "PaymentReceipt" (
    "id"         TEXT NOT NULL,
    "vendorId"   TEXT NOT NULL,
    "studentId"  TEXT NOT NULL,
    "creditId"   TEXT,
    "reference"  TEXT,
    "amount"     DECIMAL(12,2) NOT NULL,
    "bankName"   TEXT,
    "senderName" TEXT,
    "confidence" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- The dedupe guarantee: one reference can only be claimed once per vendor.
-- Postgres treats NULLs as distinct in a unique index, so unreadable references
-- (reference IS NULL) never collide with each other — which is what we want:
-- those rows are audit trail only and must not block a later real receipt.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentReceipt_vendorId_reference_key"
    ON "PaymentReceipt"("vendorId", "reference");

CREATE INDEX IF NOT EXISTS "PaymentReceipt_studentId_idx"  ON "PaymentReceipt"("studentId");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_creditId_idx"   ON "PaymentReceipt"("creditId");
CREATE INDEX IF NOT EXISTS "PaymentReceipt_createdAt_idx"  ON "PaymentReceipt"("createdAt");

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_creditId_fkey"
    FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
