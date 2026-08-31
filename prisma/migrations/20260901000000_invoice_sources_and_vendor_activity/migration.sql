-- Distinguish invoices created from the web dashboard and the WhatsApp flow.
DO $$
BEGIN
  CREATE TYPE "InvoiceSource" AS ENUM ('WEB', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "source" "InvoiceSource" NOT NULL DEFAULT 'WEB';

CREATE INDEX IF NOT EXISTS "Invoice_source_createdAt_idx"
  ON "Invoice"("source", "createdAt");

