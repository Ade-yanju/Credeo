-- Trial entitlement + subscription history.
--
-- Two changes, one purpose: make "has this vendor's trial ended?" answerable
-- from a single column, and make "WHEN did it end?" answerable at all.
--
-- Before this, a VendorSubscription row stored only its current status, so
-- finance analytics used `updatedAt` as the churn timestamp — a value any
-- later write to the row silently moved.

-- 1. When the read-only lockout actually bites. Stamped at the moment the
--    subscription lapses, never derived, so changing the grace length later
--    cannot retroactively rewrite who was locked out when.
ALTER TABLE "VendorSubscription"
  ADD COLUMN "graceEndsAt" TIMESTAMP(3);

-- 2. Append-only history of every subscription state change.
CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "fromStatus" "SubscriptionStatus",
  "toStatus" "SubscriptionStatus" NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "monthlyAmount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionEvent_vendorId_occurredAt_idx"
  ON "SubscriptionEvent"("vendorId", "occurredAt");
CREATE INDEX "SubscriptionEvent_toStatus_occurredAt_idx"
  ON "SubscriptionEvent"("toStatus", "occurredAt");
CREATE INDEX "SubscriptionEvent_reason_occurredAt_idx"
  ON "SubscriptionEvent"("reason", "occurredAt");
CREATE INDEX "SubscriptionEvent_occurredAt_idx"
  ON "SubscriptionEvent"("occurredAt");

ALTER TABLE "SubscriptionEvent"
  ADD CONSTRAINT "SubscriptionEvent_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionEvent"
  ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "VendorSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfills ──────────────────────────────────────────────────────────────
-- Entitlement now fails CLOSED: a vendor with no subscription row is treated
-- as locked instead of active-forever. Any vendor currently missing a row
-- would be locked out the moment that ships, so give them a real trial row
-- first. 60 days matches lib/tenant.ts trialEndsAt().
INSERT INTO "VendorSubscription" (
  "id", "vendorId", "plan", "status", "trialEndsAt", "monthlyAmount", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  v."id",
  'STARTER'::"SubscriptionPlan",
  'TRIAL'::"SubscriptionStatus",
  v."createdAt" + INTERVAL '60 days',
  2000,
  v."createdAt",
  CURRENT_TIMESTAMP
FROM "Vendor" v
WHERE NOT EXISTS (
  SELECT 1 FROM "VendorSubscription" s WHERE s."vendorId" = v."id"
);

-- Subscriptions that already lapsed get a grace window measured from when
-- they lapsed. trialEndsAt is the honest anchor where we have it; otherwise
-- fall back to updatedAt, which is the best signal this schema ever kept.
UPDATE "VendorSubscription"
SET "graceEndsAt" = COALESCE("trialEndsAt", "currentPeriodEnd", "updatedAt") + INTERVAL '7 days'
WHERE "status" IN ('EXPIRED', 'PAST_DUE', 'CANCELLED')
  AND "graceEndsAt" IS NULL;

-- One genesis event per existing subscription, so the new analytics are not
-- empty on day one. Marked distinctly: these are reconstructed, not observed,
-- and occurredAt is the row's creation time rather than a real transition.
INSERT INTO "SubscriptionEvent" (
  "id", "vendorId", "subscriptionId", "fromStatus", "toStatus",
  "plan", "monthlyAmount", "reason", "occurredAt"
)
SELECT
  gen_random_uuid()::text,
  s."vendorId",
  s."id",
  NULL,
  s."status",
  s."plan",
  s."monthlyAmount",
  'backfill_genesis',
  s."createdAt"
FROM "VendorSubscription" s;
