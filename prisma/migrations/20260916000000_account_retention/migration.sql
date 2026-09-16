-- Account deletion retention.
-- A deletion request disables login immediately but preserves the account and
-- its financial records until the 90-day purge job runs.

ALTER TABLE "Vendor"
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "dataRetentionUntil" TIMESTAMP(3),
  ADD COLUMN "deletionOriginalPhone" TEXT,
  ADD COLUMN "deletionOriginalEmail" TEXT;

CREATE INDEX "Vendor_dataRetentionUntil_idx"
  ON "Vendor"("dataRetentionUntil");
