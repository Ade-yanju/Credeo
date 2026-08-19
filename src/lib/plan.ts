import type { SubscriptionPlan } from "@prisma/client";
import { getEntitlement, type SubscriptionLike } from "@/lib/entitlement";

// Maximum unique customers a vendor can have credits with per plan tier.
// null = unlimited
export const PLAN_STUDENT_LIMITS: Record<SubscriptionPlan, number | null> = {
  STARTER:    50,
  GROWTH:     200,
  PRO:        null,
};

export function getStudentLimit(plan: SubscriptionPlan): number | null {
  return PLAN_STUDENT_LIMITS[plan];
}

/**
 * Returns true if the vendor may perform paid write actions.
 *
 * Now a thin delegate to getEntitlement() — the single authority (see
 * lib/entitlement.ts). Kept so the existing call sites (reminder cron, the
 * WhatsApp webhook, credit- and invoice-lifecycle) keep reading naturally,
 * and so they inherit the 7-day grace window for free.
 *
 * BEHAVIOUR CHANGE: this used to return TRUE for a vendor with no
 * subscription row, which was an unlimited free pass. It now fails CLOSED.
 * The 20260818000000_subscription_entitlement migration backfills a trial row
 * for every vendor that lacked one.
 */
export function isPlanActive(subscription: SubscriptionLike): boolean {
  return getEntitlement(subscription).canWrite;
}

export function planDisplayName(plan: SubscriptionPlan): string {
  return plan === "STARTER" ? "Starter" : plan === "GROWTH" ? "Growth" : "Business Pro";
}
