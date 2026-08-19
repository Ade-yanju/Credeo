/**
 * Vodium Ledger — subscription entitlement.
 *
 * The single authority on "what is this vendor allowed to do right now?".
 *
 * Before this file, that answer was spread across a boolean (`isPlanActive`)
 * that only two of ~35 write endpoints ever consulted, and it failed OPEN — a
 * vendor with no subscription row was treated as active forever. Everything
 * now derives from one function so the policy is auditable in one place.
 *
 * DELIBERATELY DEPENDENCY-FREE: no prisma, no next/server. This module is
 * imported by unit tests directly (see tests/unit.test.ts, which only ever
 * imports pure libs). The prisma/NextResponse guard lives next door in
 * entitlement-guard.ts.
 *
 * WHY NO NEW ENUM VALUE: GRACE is derived, not stored. Adding it to
 * SubscriptionStatus would mean auditing every existing `status` filter and
 * the admin UI's hardcoded state list (finance-client.tsx). The stored truth
 * stays "the trial expired"; the grace window is a policy laid over it.
 */

import type { SubscriptionStatus } from "@prisma/client";

/** Days of full access after a subscription lapses, before the lockout bites. */
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

export type EntitlementState =
  /** Inside the free trial. */
  | "TRIAL"
  /** Paying, inside the current period. */
  | "ACTIVE"
  /** Lapsed, but inside the grace window — still full access, being warned. */
  | "GRACE"
  /** Lapsed past grace — read-only apart from recording money received. */
  | "LOCKED";

/** The subscription fields entitlement actually reads. */
export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodEnd: Date | null;
} | null;

export interface Entitlement {
  state: EntitlementState;
  /** True for TRIAL, ACTIVE and GRACE. False only when LOCKED. */
  canWrite: boolean;
  /** When the lockout bites. Null while the subscription has not lapsed. */
  graceEndsAt: Date | null;
  /** Whole days until lockout; 0 on the final day, null when not lapsed. */
  daysUntilLockout: number | null;
  /** When the lockout began. Null unless LOCKED. */
  lockedSince: Date | null;
}

/* ------------------------------------------------------------------ */
/* Action policy                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every guarded mutation, named once. Adding a route means adding a member
 * here, which forces a decision about its locked-state behaviour rather than
 * letting it default to open.
 */
export type EntitledAction =
  | "credit.create"
  | "credit.update"
  | "repayment.create"
  | "invoice.create"
  | "invoice.send"
  | "invoice.payment"
  | "bnpl.order.create"
  | "bnpl.order.decide"
  | "bnpl.repayment.create"
  | "reminder.send"
  | "product.write"
  | "coupon.write"
  | "mandate.write"
  | "storefront.order.create"
  | "tenant.write"
  | "tenant.revoke"
  | "upload.write";

/**
 * What a LOCKED vendor may still do.
 *
 * The rule is: RECORDING MONEY ALREADY RECEIVED stays allowed; creating new
 * obligations does not. Repayment capture is the whole point of Phase 1 (see
 * CLAUDE.md's north star), and a vendor who cannot record a student's payment
 * either loses the record or writes it on paper — both destroy the data the
 * product exists to collect. Blocking it would also punish the student, whose
 * repayment history is the asset being built.
 *
 * That principle covers three endpoints, not just the obvious one: a plain
 * repayment, a repayment against a BNPL order, and a payment logged against
 * an invoice are all the same event wearing different clothes.
 *
 * One further exception, on security rather than data grounds: REVOKING staff
 * access stays allowed. Adding a team member is a paid feature, but refusing
 * to let a lapsed vendor remove a departed employee would hold an active
 * security risk open until they paid — billing pressure must never work that
 * way. Granting is gated; taking away is not.
 */
const ALLOWED_WHEN_LOCKED: Readonly<Record<EntitledAction, boolean>> = {
  "repayment.create":       true,
  "bnpl.repayment.create":  true,
  "invoice.payment":        true,
  "tenant.revoke":          true,

  "credit.create":          false,
  "credit.update":          false,
  "invoice.create":         false,
  "invoice.send":           false,
  "bnpl.order.create":      false,
  "bnpl.order.decide":      false,
  "reminder.send":          false,
  "product.write":          false,
  "coupon.write":           false,
  "mandate.write":          false,
  "storefront.order.create": false,
  "tenant.write":           false,
  "upload.write":           false,
};

export function isAllowedWhenLocked(action: EntitledAction): boolean {
  return ALLOWED_WHEN_LOCKED[action] === true;
}

/** True if this action may proceed given an entitlement. */
export function permits(entitlement: Entitlement, action: EntitledAction): boolean {
  return entitlement.canWrite || isAllowedWhenLocked(action);
}

/* ------------------------------------------------------------------ */
/* Derivation                                                         */
/* ------------------------------------------------------------------ */

/** Statuses that mean the subscription is no longer carrying the vendor. */
const LAPSED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
  "EXPIRED",
  "PAST_DUE",
  "CANCELLED",
]);

export function getEntitlement(sub: SubscriptionLike, now: Date = new Date()): Entitlement {
  // FAIL CLOSED. This used to return "active" (plan.ts:21, "Default to
  // allowing if no record"), which made a missing row an unlimited free pass.
  // The migration backfills a trial row for every vendor lacking one, so
  // reaching here means something is genuinely wrong.
  if (!sub) {
    return locked(null);
  }

  if (sub.status === "ACTIVE") {
    // No period end means Paystack is driving the lifecycle — trust it.
    if (!sub.currentPeriodEnd || sub.currentPeriodEnd >= now) {
      return { state: "ACTIVE", canWrite: true, graceEndsAt: null, daysUntilLockout: null, lockedSince: null };
    }
    return afterLapse(sub, sub.currentPeriodEnd, now);
  }

  if (sub.status === "TRIAL") {
    // A trial with no end date is a data bug, not a licence — treat the
    // absence as "not yet ended" but let the cron stamp it.
    if (!sub.trialEndsAt || sub.trialEndsAt >= now) {
      return { state: "TRIAL", canWrite: true, graceEndsAt: null, daysUntilLockout: null, lockedSince: null };
    }
    return afterLapse(sub, sub.trialEndsAt, now);
  }

  if (LAPSED_STATUSES.has(sub.status)) {
    return afterLapse(sub, sub.trialEndsAt ?? sub.currentPeriodEnd, now);
  }

  return locked(sub.graceEndsAt);
}

/**
 * Grace resolution. `graceEndsAt` is stamped by the cron at the moment of
 * lapse and is the authority. The derived fallback exists because a
 * subscription can lapse in real time between two cron runs — without it, a
 * vendor would be hard-locked for up to 24h and then handed a grace window,
 * which is worse than never having one.
 */
function afterLapse(sub: NonNullable<SubscriptionLike>, lapsedAt: Date | null, now: Date): Entitlement {
  const graceEndsAt =
    sub.graceEndsAt ?? (lapsedAt ? new Date(lapsedAt.getTime() + GRACE_DAYS * DAY_MS) : null);

  if (graceEndsAt && graceEndsAt > now) {
    return {
      state: "GRACE",
      canWrite: true,
      graceEndsAt,
      daysUntilLockout: Math.max(0, Math.ceil((graceEndsAt.getTime() - now.getTime()) / DAY_MS)),
      lockedSince: null,
    };
  }

  return locked(graceEndsAt);
}

function locked(graceEndsAt: Date | null): Entitlement {
  return {
    state: "LOCKED",
    canWrite: false,
    graceEndsAt,
    daysUntilLockout: 0,
    lockedSince: graceEndsAt,
  };
}

/* ------------------------------------------------------------------ */
/* Copy                                                              */
/* ------------------------------------------------------------------ */

/**
 * The 403 body a blocked write returns. Nigerian English, no jargon, and it
 * names what still works so the vendor is not left guessing (CLAUDE.md:
 * "Speak Nigerian", and reminders/messaging are never shaming).
 */
export function lockedMessage(action: EntitledAction): string {
  const noun = ACTION_NOUNS[action] ?? "this";
  return `Your free trial has ended, so ${noun} is paused. Your records are safe and you can still view them and record money customers pay you. Renew your plan to unlock everything.`;
}

const ACTION_NOUNS: Partial<Record<EntitledAction, string>> = {
  "credit.create":          "adding credit",
  "credit.update":          "editing credit",
  "invoice.create":         "creating invoices",
  "invoice.send":           "sending invoices",
  "bnpl.order.create":      "new pay-later orders",
  "bnpl.order.decide":      "approving pay-later orders",
  "reminder.send":          "sending reminders",
  "product.write":          "changing your products",
  "coupon.write":           "changing your coupons",
  "mandate.write":          "setting up payment mandates",
  "storefront.order.create": "new storefront orders",
  "tenant.write":           "changing your shop settings",
  "upload.write":           "uploading files",
};
