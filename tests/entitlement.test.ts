/**
 * Entitlement, grace and weekly-report period tests.
 *
 * These lock down the decisions that money depends on: who is locked out, who
 * keeps access during grace, and — most importantly — that recording a customer's
 * repayment NEVER gets blocked. That last rule protects the repayment data the
 * whole product exists to collect, so it is the one most worth a regression test.
 *
 * Only pure modules are imported (no prisma, no next/server), matching the rest
 * of the suite.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  GRACE_DAYS,
  getEntitlement,
  isAllowedWhenLocked,
  permits,
  lockedMessage,
  type SubscriptionLike,
} from "../src/lib/entitlement";
import { lastCompleteWeek, formatWeekRange } from "../src/lib/weekly-report-week";
import { signReportToken, verifyReportToken } from "../src/lib/bnpl-token";

const DAY = 86_400_000;
const NOW = new Date("2026-08-19T12:00:00.000Z"); // a Wednesday

function sub(over: Partial<NonNullable<SubscriptionLike>>): SubscriptionLike {
  return {
    status: "TRIAL",
    trialEndsAt: null,
    graceEndsAt: null,
    currentPeriodEnd: null,
    ...over,
  } as NonNullable<SubscriptionLike>;
}

/* ── State derivation ─────────────────────────────────────────────────────── */

test("entitlement: trial before its end date is TRIAL and can write", () => {
  const e = getEntitlement(sub({ status: "TRIAL", trialEndsAt: new Date(NOW.getTime() + 10 * DAY) }), NOW);
  assert.equal(e.state, "TRIAL");
  assert.equal(e.canWrite, true);
  assert.equal(e.daysUntilLockout, null);
});

test("entitlement: paying vendor inside the period is ACTIVE", () => {
  const e = getEntitlement(sub({ status: "ACTIVE", currentPeriodEnd: new Date(NOW.getTime() + 5 * DAY) }), NOW);
  assert.equal(e.state, "ACTIVE");
  assert.equal(e.canWrite, true);
});

test("entitlement: ACTIVE with no period end is trusted (Paystack drives it)", () => {
  const e = getEntitlement(sub({ status: "ACTIVE", currentPeriodEnd: null }), NOW);
  assert.equal(e.state, "ACTIVE");
  assert.equal(e.canWrite, true);
});

test("entitlement: lapsed trial inside the grace window keeps FULL access", () => {
  const e = getEntitlement(
    sub({
      status: "EXPIRED",
      trialEndsAt: new Date(NOW.getTime() - 2 * DAY),
      graceEndsAt: new Date(NOW.getTime() + 5 * DAY),
    }),
    NOW
  );
  assert.equal(e.state, "GRACE");
  assert.equal(e.canWrite, true);
  assert.equal(e.daysUntilLockout, 5);
});

test("entitlement: past the grace window is LOCKED", () => {
  const e = getEntitlement(
    sub({
      status: "EXPIRED",
      trialEndsAt: new Date(NOW.getTime() - 30 * DAY),
      graceEndsAt: new Date(NOW.getTime() - 1 * DAY),
    }),
    NOW
  );
  assert.equal(e.state, "LOCKED");
  assert.equal(e.canWrite, false);
});

test("entitlement: grace boundary is exclusive — at graceEndsAt you are locked", () => {
  const e = getEntitlement(sub({ status: "EXPIRED", graceEndsAt: new Date(NOW.getTime()) }), NOW);
  assert.equal(e.state, "LOCKED");
});

test("entitlement: PAST_DUE gets the same grace cushion as a lapsed trial", () => {
  const e = getEntitlement(
    sub({
      status: "PAST_DUE",
      currentPeriodEnd: new Date(NOW.getTime() - 1 * DAY),
      graceEndsAt: new Date(NOW.getTime() + 6 * DAY),
    }),
    NOW
  );
  assert.equal(e.state, "GRACE");
  assert.equal(e.canWrite, true);
});

test("entitlement: grace is derived when the cron has not stamped it yet", () => {
  // A trial that lapsed an hour ago, before the daily cron next runs. Without
  // the fallback this vendor would be hard-locked until the cron caught up.
  const e = getEntitlement(
    sub({ status: "TRIAL", trialEndsAt: new Date(NOW.getTime() - 3600_000), graceEndsAt: null }),
    NOW
  );
  assert.equal(e.state, "GRACE");
  assert.equal(e.canWrite, true);
  assert.equal(e.daysUntilLockout, GRACE_DAYS);
});

test("entitlement: a trial with no end date is not treated as lapsed", () => {
  const e = getEntitlement(sub({ status: "TRIAL", trialEndsAt: null }), NOW);
  assert.equal(e.state, "TRIAL");
  assert.equal(e.canWrite, true);
});

test("entitlement: FAILS CLOSED when there is no subscription row", () => {
  // This used to return "active", which made a missing row an unlimited pass.
  const e = getEntitlement(null, NOW);
  assert.equal(e.state, "LOCKED");
  assert.equal(e.canWrite, false);
});

test("entitlement: CANCELLED past grace is locked", () => {
  const e = getEntitlement(
    sub({ status: "CANCELLED", graceEndsAt: new Date(NOW.getTime() - 10 * DAY) }),
    NOW
  );
  assert.equal(e.state, "LOCKED");
});

/* ── Action policy ────────────────────────────────────────────────────────── */

test("policy: recording money received survives the lockout", () => {
  // The north-star rule. If this ever flips, vendors go back to paper and the
  // repayment history the product exists to build stops being collected.
  assert.equal(isAllowedWhenLocked("repayment.create"), true);
  assert.equal(isAllowedWhenLocked("bnpl.repayment.create"), true);
  assert.equal(isAllowedWhenLocked("invoice.payment"), true);
});

test("policy: revoking staff access survives the lockout", () => {
  // Never hold an active security risk open as billing pressure.
  assert.equal(isAllowedWhenLocked("tenant.revoke"), true);
  assert.equal(isAllowedWhenLocked("tenant.write"), false);
});

test("policy: extending new credit does NOT survive the lockout", () => {
  for (const action of ["credit.create", "credit.update", "invoice.create", "invoice.send",
    "bnpl.order.create", "bnpl.order.decide", "reminder.send", "product.write",
    "coupon.write", "mandate.write", "storefront.order.create", "upload.write"] as const) {
    assert.equal(isAllowedWhenLocked(action), false, `${action} must be blocked when locked`);
  }
});

test("policy: permits() lets a locked vendor record a repayment but not add credit", () => {
  const locked = getEntitlement(null, NOW);
  assert.equal(permits(locked, "repayment.create"), true);
  assert.equal(permits(locked, "credit.create"), false);
});

test("policy: everything is permitted while in grace", () => {
  const grace = getEntitlement(
    sub({ status: "EXPIRED", graceEndsAt: new Date(NOW.getTime() + 3 * DAY) }),
    NOW
  );
  assert.equal(permits(grace, "credit.create"), true);
  assert.equal(permits(grace, "invoice.send"), true);
});

test("copy: the refusal names the blocked action and never blames the vendor", () => {
  const msg = lockedMessage("invoice.create");
  assert.match(msg, /creating invoices/);
  assert.match(msg, /records are safe/);
});

/* ── Weekly report period ─────────────────────────────────────────────────── */

test("week: Monday run covers the previous Monday to Sunday", () => {
  // Monday 24 Aug 2026, 06:00 Lagos (05:00 UTC).
  const { weekStart, weekEnd } = lastCompleteWeek(new Date("2026-08-24T05:00:00.000Z"));
  // Mon 17 Aug 00:00 Lagos === 16 Aug 23:00 UTC
  assert.equal(weekStart.toISOString(), "2026-08-16T23:00:00.000Z");
  // through Sun 23 Aug 23:59:59.999 Lagos
  assert.equal(weekEnd.toISOString(), "2026-08-23T22:59:59.999Z");
});

test("week: a mid-week run still reports the last COMPLETE week", () => {
  // Wednesday — a retry after a failed Monday must not shift the window.
  const wed = lastCompleteWeek(new Date("2026-08-26T09:00:00.000Z"));
  const mon = lastCompleteWeek(new Date("2026-08-24T05:00:00.000Z"));
  assert.equal(wed.weekStart.toISOString(), mon.weekStart.toISOString());
});

test("week: Sunday belongs to the week that is still running, not the finished one", () => {
  // Sunday 23 Aug 2026 22:00 Lagos. The week 17–23 Aug has not closed yet, so
  // the last complete week is still 10–16 Aug.
  const { weekStart } = lastCompleteWeek(new Date("2026-08-23T21:00:00.000Z"));
  assert.equal(weekStart.toISOString(), "2026-08-09T23:00:00.000Z");
});

test("week: the window is exactly 7 days minus a millisecond", () => {
  const { weekStart, weekEnd } = lastCompleteWeek(new Date("2026-08-24T05:00:00.000Z"));
  assert.equal(weekEnd.getTime() - weekStart.getTime(), 7 * DAY - 1);
});

test("week: range label is human and carries the year", () => {
  const { weekStart, weekEnd } = lastCompleteWeek(new Date("2026-08-24T05:00:00.000Z"));
  const label = formatWeekRange(weekStart, weekEnd);
  assert.match(label, /17/);
  assert.match(label, /23/);
  assert.match(label, /2026/);
});

/* ── Report token ─────────────────────────────────────────────────────────── */

test("report token: round-trips the vendor and the week", () => {
  const weekStart = new Date("2026-08-16T23:00:00.000Z");
  const token = signReportToken("clv1x2y3z4a5b6c7d8e9f0", weekStart);
  const parsed = verifyReportToken(token);
  assert.ok(parsed);
  assert.equal(parsed.vendorId, "clv1x2y3z4a5b6c7d8e9f0");
  // Pinned to the calendar day, so the link is stable for that week.
  assert.equal(parsed.weekStart.toISOString().slice(0, 10), "2026-08-16");
});

test("report token: a tampered token is rejected", () => {
  const token = signReportToken("clv1x2y3z4a5b6c7d8e9f0", new Date("2026-08-16T23:00:00.000Z"));
  const [payload, sig] = token.split(".");
  // Swap the payload for another vendor, keep the signature.
  const forged = `${Buffer.from("clOTHERVENDOR12345678|2026-08-16", "utf8").toString("base64url")}.${sig}`;
  assert.equal(verifyReportToken(forged), null);
  assert.equal(verifyReportToken(`${payload}.deadbeef`), null);
  assert.equal(verifyReportToken("nonsense"), null);
});
