/**
 * Vodium Ledger — subscription event log.
 *
 * ONE write path for subscription history. Five places mutate
 * VendorSubscription.status (registration, the daily cron twice, and three
 * Paystack webhook branches) and before this none of them recorded when the
 * change happened. Finance analytics fell back to `updatedAt`, which any
 * later write to the row silently moved — so "churned this month" was a guess
 * dressed as a number.
 *
 * Funnelling every mutation through recordSubscriptionEvent() is what makes
 * trial-end dates exact, churn timing stable, and an MRR series possible.
 */

import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Machine-readable cause of a transition. Also the send-once key for grace
 * nudges — see hasSubscriptionEvent().
 */
export type SubscriptionEventReason =
  | "trial_started"
  | "trial_expired"
  | "period_lapsed_past_due"
  | "paystack_charge_success"
  | "paystack_subscription_disabled"
  | "paystack_payment_failed"
  | "grace_nudge_day0"
  | "grace_nudge_day3"
  | "grace_nudge_day6"
  | "backfill_genesis";

export interface RecordEventInput {
  vendorId: string;
  subscriptionId?: string | null;
  fromStatus?: SubscriptionStatus | null;
  toStatus: SubscriptionStatus;
  plan: SubscriptionPlan;
  monthlyAmount: number | string;
  reason: SubscriptionEventReason;
  occurredAt?: Date;
}

/**
 * Append one event.
 *
 * BEST EFFORT ON PURPOSE: a failed history insert must never roll back the
 * billing change that prompted it — losing an audit row is bad, refusing a
 * vendor's successful payment is worse. Failures are logged loudly instead.
 */
export async function recordSubscriptionEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.subscriptionEvent.create({
      data: {
        vendorId:       input.vendorId,
        subscriptionId: input.subscriptionId ?? null,
        fromStatus:     input.fromStatus ?? null,
        toStatus:       input.toStatus,
        plan:           input.plan,
        monthlyAmount:  input.monthlyAmount,
        reason:         input.reason,
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      },
    });
  } catch (err) {
    console.error(
      `[subscription-events] FAILED to record "${input.reason}" for vendor ${input.vendorId}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Has this vendor already had an event with this reason (optionally since a
 * cutoff)? Used to make grace nudges send-once, so a cron re-run — or two
 * runs in one day — cannot double-message a vendor.
 */
export async function hasSubscriptionEvent(
  vendorId: string,
  reason: SubscriptionEventReason,
  since?: Date
): Promise<boolean> {
  const found = await prisma.subscriptionEvent.findFirst({
    where: {
      vendorId,
      reason,
      ...(since ? { occurredAt: { gte: since } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}
