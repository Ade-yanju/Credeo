import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyDailyDefaultDecay, markOverdueCredits } from "@/lib/credit-lifecycle";
import { markOverdueInvoices, sendOverdueInvoiceReminders } from "@/lib/invoice-lifecycle";
import { GRACE_DAYS } from "@/lib/entitlement";
import { recordSubscriptionEvent } from "@/lib/subscription-events";
import { sendGraceNudges } from "@/lib/subscription-nudge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // 0. Credit lifecycle: mark new defaults and apply the daily default-score
  // decay. Guaranteed to run daily via this Vercel cron; idempotent if the
  // reminders cron already ran it today.
  const overdue = await markOverdueCredits({ now });
  const defaultDecay = await applyDailyDefaultDecay({ now });
  const overdueInvoices = await markOverdueInvoices({ now });
  const invoiceReminders = await sendOverdueInvoiceReminders({ now });

  // 1. Expire trials that have passed their end date.
  //
  // Row-by-row rather than the old updateMany: each transition has to stamp
  // its own graceEndsAt and write its own history row. `occurredAt` is the
  // real trialEndsAt, NOT now — so a cron that runs late (or catches up after
  // an outage) still records when the trial actually ended. That accuracy is
  // the whole reason the event log exists.
  const lapsingTrials = await prisma.vendorSubscription.findMany({
    where: { status: "TRIAL", trialEndsAt: { lt: now } },
    select: { id: true, vendorId: true, plan: true, monthlyAmount: true, trialEndsAt: true },
  });

  for (const sub of lapsingTrials) {
    const lapsedAt = sub.trialEndsAt ?? now;
    await prisma.vendorSubscription.update({
      where: { id: sub.id },
      data: { status: "EXPIRED", graceEndsAt: new Date(lapsedAt.getTime() + GRACE_DAYS * DAY_MS) },
    });
    await recordSubscriptionEvent({
      vendorId: sub.vendorId,
      subscriptionId: sub.id,
      fromStatus: "TRIAL",
      toStatus: "EXPIRED",
      plan: sub.plan,
      monthlyAmount: sub.monthlyAmount.toString(),
      reason: "trial_expired",
      occurredAt: lapsedAt,
    });
  }

  // 2. Mark active subscriptions as PAST_DUE if currentPeriodEnd is passed.
  // Usually Paystack webhooks handle this; this is the safety net for missed
  // or delayed webhooks. A failed payment gets the same grace as a trial.
  const lapsingActive = await prisma.vendorSubscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
    select: { id: true, vendorId: true, plan: true, monthlyAmount: true, currentPeriodEnd: true },
  });

  for (const sub of lapsingActive) {
    const lapsedAt = sub.currentPeriodEnd ?? now;
    await prisma.vendorSubscription.update({
      where: { id: sub.id },
      data: { status: "PAST_DUE", graceEndsAt: new Date(lapsedAt.getTime() + GRACE_DAYS * DAY_MS) },
    });
    await recordSubscriptionEvent({
      vendorId: sub.vendorId,
      subscriptionId: sub.id,
      fromStatus: "ACTIVE",
      toStatus: "PAST_DUE",
      plan: sub.plan,
      monthlyAmount: sub.monthlyAmount.toString(),
      reason: "period_lapsed_past_due",
      occurredAt: lapsedAt,
    });
  }

  // 3. In-app notification for anything that lapsed in the last 24h.
  const expiredSubs = await prisma.vendorSubscription.findMany({
    where: {
      status: { in: ["EXPIRED", "PAST_DUE"] },
      updatedAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
    select: { vendorId: true },
  });

  for (const sub of expiredSubs) {
    // Check if notification already exists for today to avoid spam
    const existing = await prisma.notification.findFirst({
      where: {
        vendorId: sub.vendorId,
        title: "Subscription Expired",
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          vendorId: sub.vendorId,
          title: "Subscription Expired",
          message: `Your free trial has ended. You have ${GRACE_DAYS} days of full access left — renew to keep adding credits and sending reminders.`,
          type: "WARNING",
        },
      });
    }
  }

  // 4. Escalating grace nudges (day 0 / 3 / 6). Send-once per stage, keyed off
  // the event log, so a re-run cannot double-message anyone.
  const nudges = await sendGraceNudges({ now });

  return NextResponse.json({
    ok: true,
    expiredTrials: lapsingTrials.length,
    overdueSubs: lapsingActive.length,
    notificationsSent: expiredSubs.length,
    nudges,
    overdue,
    defaultDecay,
    invoices: { marked: overdueInvoices.marked, reminders: invoiceReminders },
  });
}
