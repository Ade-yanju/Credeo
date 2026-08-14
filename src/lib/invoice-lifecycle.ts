/**
 * Vodium Ledger — invoice lifecycle.
 *
 * Mirrors the credit reminder stream: invoices that pass their due date unpaid
 * are marked OVERDUE, and the customer gets a respectful WhatsApp reminder with
 * a link to the invoice — repeated every few days until it's settled.
 *
 * Honours the merchant's reminder preference (overdueRemindersEnabled), sends
 * from the store's own WhatsApp number when connected, and throttles via
 * `overdueReminderSentAt` so a customer is never spammed.
 */

import { prisma } from "@/lib/prisma";
import { getOrgChannelCredentials, type ChannelCredentials } from "@/lib/whatsapp/channel-token";
import { createReminderPrefResolver } from "@/lib/reminder-prefs";
import { signInvoiceToken } from "@/lib/bnpl-token";
import { formatNaira } from "@/lib/utils";
import { sendCustomerInvoice } from "@/lib/whatsapp/invoice-delivery";
import { isPlanActive } from "@/lib/plan";

const REMINDER_INTERVAL_MS = 3 * 86_400_000; // re-remind at most every 3 days

type Scope = { now?: Date; force?: boolean };

/** Move SENT / PARTIALLY_PAID invoices past their due date to OVERDUE. */
export async function markOverdueInvoices(scope: Scope = {}) {
  const now = scope.now ?? new Date();

  const result = await prisma.invoice.updateMany({
    where: {
      status: { in: ["SENT", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  return { marked: result.count };
}

/** WhatsApp customers with overdue invoices. */
export async function sendOverdueInvoiceReminders(scope: Scope = {}) {
  const now = scope.now ?? new Date();
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);

  const invoices = await prisma.invoice.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { lt: now },
      ...(scope.force
        ? {}
        : { OR: [{ overdueReminderSentAt: null }, { overdueReminderSentAt: { lte: cutoff } }] }),
      student: { NOT: { phone: { startsWith: "pending:" } } },
    },
    include: {
      student: true,
      organization: {
        select: {
          id: true,
          name: true,
          vendors: { select: { subscription: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 500,
  });

  const remindersAllowed = createReminderPrefResolver();
  const credsCache = new Map<string, ChannelCredentials | null>();
  async function credsFor(organizationId: string): Promise<ChannelCredentials | null> {
    if (!credsCache.has(organizationId)) {
      credsCache.set(organizationId, await getOrgChannelCredentials(organizationId));
    }
    return credsCache.get(organizationId) ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vodiumledger.com";
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
    if (outstanding <= 0) continue;

    // An organisation can have several staff vendors; keep reminders running
    // only while at least one of its subscriptions is active. A sole vendor
    // whose trial expires therefore stops all automated invoice reminders.
    if (!invoice.organization.vendors.some((vendor) => isPlanActive(vendor.subscription))) {
      skipped++;
      continue;
    }

    // Merchant opted out of automated reminders.
    if (!scope.force && !(await remindersAllowed(invoice.organizationId, "overdue"))) {
      skipped++;
      continue;
    }

    const daysLate = Math.max(1, Math.ceil((now.getTime() - invoice.dueDate.getTime()) / 86_400_000));
    const token = signInvoiceToken(invoice.id);
    const link = `${appUrl}/invoice/${token}`;
    const pdfLink = `${appUrl}/invoice/${token}/pdf`;
    const body =
      `Hi *${invoice.student.fullName}* 👋\n\n` +
      `A gentle reminder from *${invoice.organization.name}*: invoice ${invoice.invoiceNumber} is ` +
      `overdue by ${daysLate} day${daysLate === 1 ? "" : "s"}.\n\n` +
      `*Balance due:* ${formatNaira(outstanding)}\n\n` +
      `View your invoice:\n${link}\n\n` +
      `If you've already paid, please ignore this message. Thank you! 🙏`;

    try {
      const delivery = await sendCustomerInvoice({
        phone: invoice.student.phone,
        customerName: invoice.student.fullName,
        shopName: invoice.organization.name,
        invoiceNumber: invoice.invoiceNumber,
        total: outstanding,
        dueDate: invoice.dueDate,
        link,
        pdfLink,
        richBody: body,
        creds: (await credsFor(invoice.organizationId)) ?? undefined,
        now,
      });
      console.log(`[invoice-reminders] invoice=${invoice.invoiceNumber} to=${invoice.student.phone} channel=${delivery.channel} delivered=${delivery.delivered}`);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { overdueReminderSentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`[invoice-reminders] failed for invoice ${invoice.id}:`, err);
      failed++;
    }
  }

  return { sent, failed, skipped, total: invoices.length };
}
