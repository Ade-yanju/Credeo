-- Opaque, server-resolved registration links for merchant acquisition.
-- Only an HMAC hash of the random bearer token is retained.
ALTER TABLE "AcquisitionProspect"
  ADD COLUMN "registrationTokenHash" TEXT,
  ADD COLUMN "registrationTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AcquisitionProspect_registrationTokenHash_key"
  ON "AcquisitionProspect"("registrationTokenHash");
