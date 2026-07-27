/**
 * GET /api/cron/reminders
 *
 * Runs every 5 minutes (see vercel.json). It must be frequent: a 30-minute
 * credit has a 10-minute reminder window, so a daily schedule would miss short
 * credits entirely — the window opens and closes between runs and the credit
 * then falls out of the pre-due query as soon as it is overdue.
 *
 * Per-day work (score decay) lives in /api/cron/daily so it is not repeated
 * 288 times a day.
 *
 * SCHEDULING IS EXTERNAL. This project does not use Vercel cron; the schedule
 * lives in cron-job.org, which must call:
 *
 *     GET https://www.vodiumledger.com/api/cron/reminders
 *     Authorization: Bearer <CRON_SECRET>
 *
 * every 5 minutes. That interval is not arbitrary — it must stay at or below
 * the shortest reminder window the bot can produce (10 minutes, for a "30M"
 * credit), or short-dated credits are never reminded at all.
 *
 * Because the schedule is not in this repo, changing the lead times here has a
 * consequence nothing in the codebase can enforce: update the external job too.
 * Finds every credit within its reminder window that hasn't been reminded yet,
 * sends a WhatsApp message to the student, and stamps reminderSentAt.
 *
 * Protected by CRON_SECRET (Vercel injects this automatically).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WhatsAppSendError } from "@/lib/whatsapp/outbound";
import { messages, payToBlock } from "@/lib/whatsapp/messages";
import { isReminderDue } from "@/lib/whatsapp/state-machine";
import { sendCustomerReminder } from "@/lib/whatsapp/reminder-delivery";
import { markOverdueCredits, sendOverdueReminders, sendEscalations } from "@/lib/credit-lifecycle";
import { createReminderPrefResolver } from "@/lib/reminder-prefs";
import { markOverdueInvoices, sendOverdueInvoiceReminders } from "@/lib/invoice-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REMINDER_LOOKAHEAD_MINUTES = 7 * 1440;

export async function GET(req: NextRequest) {
  // Auth: Vercel passes Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("[cron/reminders] CRON_SECRET not set — refusing to run in production");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const maxLookahead = new Date(now.getTime() + MAX_REMINDER_LOOKAHEAD_MINUTES * 60_000);
  const overdueLifecycle = await markOverdueCredits({ now });
  const overdueReminders = await sendOverdueReminders({ now });
  // Firmer follow-up to anyone who ignored a reminder ≥2h ago (once per credit).
  const escalations = await sendEscalations({ now });

  // Invoices follow the same stream: mark overdue, then remind.
  const overdueInvoices = await markOverdueInvoices({ now });
  const invoiceReminders = await sendOverdueInvoiceReminders({ now });

  // Find possible reminder candidates. Each credit is filtered below using
  // its own adaptive reminder lead time, so hour-based debts are not told
  // about "2 days before" reminders.
  const credits = await prisma.credit.findMany({
    where: {
      status:        { in: ["OUTSTANDING", "DUE_SOON"] },
      dueDate:       { gte: now, lte: maxLookahead },
      reminderSentAt: null,
      remindersEnabled: true, // vendor opted out of messaging this customer otherwise
      student: {
        // Only send to students with a real phone number (not a pending: placeholder)
        NOT: { phone: { startsWith: "pending:" } },
        // ...and skip anyone Meta has told us is permanently undeliverable.
        whatsappBlockedAt: null,
      },
    },
    include: {
      student: true,
      vendor:  true,
    },
  });

  let sent = 0;
  let failed = 0;
  let blocked = 0;
  let notYetDue = 0; // counted so 'nothing sent' is explainable
  const vendorSentCount: Record<string, number> = {};

  // Merchants can turn off customer reminders — respect that (cached per org).
  const remindersAllowed = createReminderPrefResolver();
  let skipped = 0;

  for (const credit of credits) {
    const student  = credit.student;
    const vendor   = credit.vendor;

    if (!(await remindersAllowed(vendor.organizationId, "preDue"))) {
      skipped++;
      continue;
    }

    const diffMins = Math.ceil((credit.dueDate.getTime() - now.getTime()) / 60_000);

    // Not yet inside this credit's reminder window — leave it for a later run.
    if (!isReminderDue(credit, now)) {
      notYetDue++;
      continue;
    }
    
    let dueTxt = "";
    if (diffMins < 0) {
      dueTxt = "as soon as possible (overdue)";
    } else if (diffMins < 60) {
      dueTxt = `in ${diffMins} minute${diffMins === 1 ? "" : "s"}`;
    } else if (diffMins < 1440) {
      const hours = Math.round(diffMins / 60);
      dueTxt = `in ${hours} hour${hours === 1 ? "" : "s"}`;
    } else {
      const days = Math.round(diffMins / 1440);
      dueTxt = days === 1 ? "tomorrow" : `in ${days} days`;
    }

    const body = messages.reminderToCustomer(
      student.fullName,
      vendor.businessName,
      Number(credit.amount) - Number(credit.amountRepaid),
      dueTxt,
      payToBlock(vendor) // vendor's bank details, or "" when unset
    );

    try {
      // "I've paid" raises a claim the vendor must confirm — it never marks the
      // credit paid on its own. "Not my credit" opens a dispute for review.
      // Delivery is session-aware: customers with no open 24h window get the
      // approved template instead (free text to them is silently dropped).
      await sendCustomerReminder({
        phone: student.phone,
        customerName: student.fullName,
        shopName: vendor.businessName,
        amountOwed: Number(credit.amount) - Number(credit.amountRepaid),
        dueText: diffMins < 0 ? "now overdue" : `due ${dueTxt}`,
        richBody: body,
        buttons: [
          { id: "PAID", title: "I've paid ✓" },
          { id: `DISPUTE_${credit.id}`, title: "Not my credit" },
        ],
        now,
      });

      // Stamp the credit so we don't remind again.
      await prisma.credit.update({
        where: { id: credit.id },
        data:  { reminderSentAt: now, status: "DUE_SOON" },
      });

      vendorSentCount[credit.vendorId] = (vendorSentCount[credit.vendorId] || 0) + 1;
      sent++;
    } catch (err) {
      console.error(`[cron/reminders] failed for credit ${credit.id}:`, err);
      failed++;

      // A permanent failure means this customer blocked the bot or isn't on
      // WhatsApp. Retrying every cron run would burn Meta quota forever, so
      // record it, stop reminding this credit, and hand the follow-up back to
      // the vendor — who can still reach them in person.
      if (err instanceof WhatsAppSendError && err.permanent) {
        blocked++;
        await prisma.student.update({
          where: { id: student.id },
          data: { whatsappBlockedAt: now },
        }).catch(() => {});
        await prisma.credit.update({
          where: { id: credit.id },
          data: { reminderSentAt: now },
        }).catch(() => {});
        await prisma.notification.create({
          data: {
            vendorId: credit.vendorId,
            title: "Customer unreachable on WhatsApp",
            message: `We couldn't deliver a reminder to ${student.fullName} — they may have blocked the Vodium number or the number isn't on WhatsApp. Please follow up with them directly.`,
            type: "WARNING",
          },
        }).catch(() => {});
      }
    }
  }

  // Notify vendors about the sent reminders
  const combinedVendorSentCount = { ...overdueReminders.vendorSentCount };
  for (const [vendorId, count] of Object.entries(vendorSentCount)) {
    combinedVendorSentCount[vendorId] = (combinedVendorSentCount[vendorId] ?? 0) + count;
  }

  for (const [vendorId, count] of Object.entries(combinedVendorSentCount)) {
    await prisma.notification.create({
      data: {
        vendorId,
        title: "Reminders Sent",
        message: `We automatically sent WhatsApp reminders to ${count} customers owing you today.`,
        type: "INFO",
      },
    });
  }

  if (blocked > 0) {
    console.warn(`[cron/reminders] ${blocked} customer(s) unreachable on WhatsApp — reminders stopped for them`);
  }

  const totalSent = sent + overdueReminders.sent;
  const totalFailed = failed + overdueReminders.failed;
  // Say WHY nothing was sent, not just that it wasn't — "sent=0 total=1"
  // alone reads like a fault when it's usually a credit whose reminder
  // window simply hasn't opened yet.
  console.log(
    `[cron/reminders] sent=${totalSent} failed=${totalFailed} ` +
    `total=${credits.length + overdueReminders.total} notYetDue=${notYetDue} ` +
    `skipped=${skipped + overdueReminders.skipped} blocked=${blocked}`
  );
  return NextResponse.json({
    ok: true,
    sent: totalSent,
    failed: totalFailed,
    blocked, // customers newly marked unreachable this run
    escalations,
    total: credits.length + overdueReminders.total,
    notYetDue,
    skipped: { preDue: skipped, overdue: overdueReminders.skipped, invoices: invoiceReminders.skipped },
    overdue: overdueLifecycle,
    invoices: { marked: overdueInvoices.marked, reminders: invoiceReminders },
    overdueReminders: {
      sent: overdueReminders.sent,
      failed: overdueReminders.failed,
      total: overdueReminders.total,
    },
  });
}
