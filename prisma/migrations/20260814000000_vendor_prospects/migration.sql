CREATE TABLE "VendorProspect" (
  "id" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "claimToken" TEXT NOT NULL,
  "claimTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "claimedVendorId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorProspect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorProspect_phone_key" ON "VendorProspect"("phone");
CREATE UNIQUE INDEX "VendorProspect_email_key" ON "VendorProspect"("email");
CREATE UNIQUE INDEX "VendorProspect_claimToken_key" ON "VendorProspect"("claimToken");
CREATE UNIQUE INDEX "VendorProspect_claimedVendorId_key" ON "VendorProspect"("claimedVendorId");
CREATE INDEX "VendorProspect_claimToken_idx" ON "VendorProspect"("claimToken");
CREATE INDEX "VendorProspect_claimedAt_idx" ON "VendorProspect"("claimedAt");
CREATE INDEX "VendorProspect_createdByAdminId_idx" ON "VendorProspect"("createdByAdminId");
