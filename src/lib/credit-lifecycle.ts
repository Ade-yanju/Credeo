import { prisma } from "@/lib/prisma";
import { WhatsAppSendError } from "@/lib/whatsapp/outbound";
import { sendCustomerReminder } from "@/lib/whatsapp/reminder-delivery";
import { getOrgChannelCredentials, type ChannelCredentials } from "@/lib/whatsapp/channel-token";
import { createReminderPrefResolver } from "@/lib/reminder-prefs";
import { messages, payToBlock } from "@/lib/whatsapp/messages";
import { maskPhone } from "@/lib/customer-verify-token";

const DEFAULT_SCORE_DELTA = -80;
const OVERDUE_REMINDER_INTERVAL_MS = 3 * 86_400_000;
/** Escalate a reminder the customer never answered after this long. */
const ESCALATION_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

// Ongoing penalty: a customer who stays in default loses points every day until
// they pay. Floored so default decay alone can't zero out a score.
const DAILY_DEFAULT_DECAY = 5;
const MIN_DEFAULT_SCORE = 300;

type LifecycleScope = {
  vendorId?: string;
  now?: Date;
};

export async function markOverdueCredits(scope: LifecycleScope = {}) {
  const now = scope.now ?? new Date();
  const credits = await prisma.credit.findMany({
    where: {
      ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
      status: { in: ["OUTSTANDING", "DUE_SOON", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
    },
    include: {
      student: true,
    },
  });

  let marked = 0;
  let penalized = 0;

  for (const credit of credits) {
    const amountOwed = Number(credit.amount) - Number(credit.amountRepaid);
    if (amountOwed <= 0) continue;

    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.credit.updateMany({
        where: {
          id: credit.id,
          status: { in: ["OUTSTANDING", "DUE_SOON", "PARTIALLY_PAID"] },
          dueDate: { lt: now },
        },
        data: { status: "OVERDUE" },
      });
      if (updateResult.count === 0) return;

      marked++;

      const defaultEvent = await tx.creditScoreEvent.findFirst({
        where: { creditId: credit.id, eventType: "DEFAULTED" },
        select: { id: true },
      });

      if (!defaultEvent) {
        await tx.creditScoreEvent.create({
          data: {
            studentId: credit.studentId,
            vendorId: credit.vendorId,
            creditId: credit.id,
            eventType: "DEFAULTED",
            amount: amountOwed,
            scoreDelta: DEFAULT_SCORE_DELTA,
            occurredAt: now,
          },
        });

        await tx.student.update({
          where: { id: credit.studentId },
          data: {
            vodiumScore: Math.max(0, (credit.student.vodiumScore ?? 500) + DEFAULT_SCORE_DELTA),
            scoreUpdatedAt: now,
          },
        });
        penalized++;
      }
    });
  }

  return { marked, penalized };
}

/**
 * Daily score decay for customers still in default.
 *
 * Every customer with an unpaid OVERDUE credit loses `DAILY_DEFAULT_DECAY`
 * points once per day (floored at `MIN_DEFAULT_SCORE`) until they pay it down.
 * Idempotent per day: a customer who already has a DEFAULTED score event today
 * (either the initial default hit or an earlier decay run) is skipped, so the
 * cron can run multiple times a day without stacking penalties.
 */
export async function applyDailyDefaultDecay(scope: LifecycleScope = {}) {
  const now = scope.now ?? new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const overdue = await prisma.credit.findMany({
    where: {
      status: "OVERDUE",
      ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
    },
    select: { studentId: true, vendorId: true, amount: true, amountRepaid: true },
  });

  // One representative vendor per still-owing customer (for event attribution).
  const owingStudents = new Map<string, string>();
  for (const credit of overdue) {
    if (Number(credit.amount) - Number(credit.amountRepaid) <= 0) continue;
    if (!owingStudents.has(credit.studentId)) owingStudents.set(credit.studentId, credit.vendorId);
  }

  const studentIds = [...owingStudents.keys()];
  if (studentIds.length === 0) return { decayed: 0, eligible: 0 };

  const decayedToday = await prisma.creditScoreEvent.findMany({
    where: { studentId: { in: studentIds }, eventType: "DEFAULTED", occurredAt: { gte: startOfDay } },
    select: { studentId: true },
  });
  const skip = new Set(decayedToday.map((e) => e.studentId));

  const targets = await prisma.student.findMany({
    where: { id: { in: studentIds.filter((id) => !skip.has(id)) } },
    select: { id: true, vodiumScore: true },
  });

  let decayed = 0;
  for (const student of targets) {
    if (student.vodiumScore <= MIN_DEFAULT_SCORE) continue;
    const newScore = Math.max(MIN_DEFAULT_SCORE, student.vodiumScore - DAILY_DEFAULT_DECAY);
    const delta = newScore - student.vodiumScore;
    if (delta === 0) continue;

    await prisma.$transaction([
      prisma.creditScoreEvent.create({
        data: {
          studentId: student.id,
          vendorId: owingStudents.get(student.id)!,
          eventType: "DEFAULTED",
          scoreDelta: delta,
          occurredAt: now,
        },
      }),
      prisma.student.update({
        where: { id: student.id },
        data: { vodiumScore: newScore, scoreUpdatedAt: now },
      }),
    ]);
    decayed++;
  }

  return { decayed, eligible: studentIds.length };
}

export async function sendOverdueReminders(scope: LifecycleScope & { force?: boolean } = {}) {
  const now = scope.now ?? new Date();
  const cutoff = new Date(now.getTime() - OVERDUE_REMINDER_INTERVAL_MS);

  const overdue = await prisma.credit.findMany({
    where: {
      ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
      status: "OVERDUE",
      dueDate: { lt: now },
      ...(scope.force
        ? {}
        : { OR: [{ overdueReminderSentAt: null }, { overdueReminderSentAt: { lte: cutoff } }] }),
      remindersEnabled: true, // vendor opted out of messaging this customer otherwise
      student: {
        NOT: { phone: { startsWith: "pending:" } },
        // ...and skip anyone Meta has told us is permanently undeliverable.
        // Without this the same unreachable customer is retried every 5
        // minutes forever — the pre-due path has always filtered on it.
        whatsappBlockedAt: null,
      },
    },
    include: { student: true, vendor: true },
    orderBy: { dueDate: "asc" },
  });

  let sent = 0;
  let failed = 0;
  let blocked = 0;
  const vendorSentCount: Record<string, number> = {};
  const grouped = new Map<string, {
    creditIds: string[];
    student: typeof overdue[number]["student"];
    vendor: typeof overdue[number]["vendor"];
    totalOwed: number;
    oldestDueDate: Date;
  }>();

  for (const credit of overdue) {
    const amountOwed = Number(credit.amount) - Number(credit.amountRepaid);
    if (amountOwed <= 0) continue;

    const key = `${credit.vendorId}:${credit.studentId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.creditIds.push(credit.id);
      existing.totalOwed += amountOwed;
      if (credit.dueDate < existing.oldestDueDate) existing.oldestDueDate = credit.dueDate;
    } else {
      grouped.set(key, {
        creditIds: [credit.id],
        student: credit.student,
        vendor: credit.vendor,
        totalOwed: amountOwed,
        oldestDueDate: credit.dueDate,
      });
    }
  }

  // Resolve outbound credentials once per organization (cached for this run).
  const credsCache = new Map<string, ChannelCredentials | null>();
  async function credsFor(organizationId: string | null): Promise<ChannelCredentials | null> {
    const key = organizationId ?? "__global__";
    if (!credsCache.has(key)) credsCache.set(key, await getOrgChannelCredentials(organizationId));
    return credsCache.get(key) ?? null;
  }

  // Merchants can turn AUTOMATED customer reminders off — respect that. A manual
  // "remind now" (scope.force) is an explicit merchant action and still sends.
  const remindersAllowed = createReminderPrefResolver();
  let skipped = 0;

  for (const item of grouped.values()) {
    if (!scope.force && !(await remindersAllowed(item.vendor.organizationId, "overdue"))) {
      skipped++;
      continue;
    }

    const daysOverdue = Math.max(
      1,
      Math.ceil((now.getTime() - item.oldestDueDate.getTime()) / 86_400_000)
    );
    const dueText = `overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;

    try {
      const creds = await credsFor(item.vendor.organizationId);
      await sendCustomerReminder({
        phone: item.student.phone,
        customerName: item.student.fullName,
        shopName: item.vendor.businessName,
        amountOwed: item.totalOwed,
        dueText,
        richBody: messages.reminderToCustomer(
          item.student.fullName,
          item.vendor.businessName,
          item.totalOwed,
          dueText,
          payToBlock(item.vendor)
        ),
        creds: creds ?? undefined,
        now,
      });

      await prisma.credit.updateMany({
        where: { id: { in: item.creditIds } },
        data: { overdueReminderSentAt: now },
      });

      vendorSentCount[item.vendor.id] = (vendorSentCount[item.vendor.id] ?? 0) + 1;
      sent++;
    } catch (err) {
      const code = err instanceof WhatsAppSendError ? err.code : undefined;
      console.error(
        `[overdue-reminders] failed for customer ${item.student.id} ` +
        `(${maskPhone(item.student.phone)}${code ? `, Meta code ${code}` : ""}):`,
        err instanceof Error ? err.message : err,
      );
      failed++;

      // Permanent means this number will never receive a message — blocked, or
      // not on WhatsApp. Record it so the next run skips them, and tell the
      // vendor, who can still chase the debt in person. Mirrors the pre-due
      // reminder path; without it this loop retried the same number forever.
      if (err instanceof WhatsAppSendError && err.permanent) {
        blocked++;
        await prisma.student
          .update({ where: { id: item.student.id }, data: { whatsappBlockedAt: now } })
          .catch(() => {});
        await prisma.credit
          .updateMany({ where: { id: { in: item.creditIds } }, data: { overdueReminderSentAt: now } })
          .catch(() => {});
        await prisma.notification
          .create({
            data: {
              vendorId: item.vendor.id,
              title: "Customer unreachable on WhatsApp",
              message:
                `We couldn't deliver an overdue reminder to ${item.student.fullName} — they may have ` +
                `blocked the Vodium number or it isn't on WhatsApp. Please follow up directly.`,
              type: "WARNING",
            },
          })
          .catch(() => {});
      }
    }
  }

  return { sent, failed, skipped, blocked, total: grouped.size, vendorSentCount };
}

/**
 * Firmer follow-up when a reminder goes unanswered.
 *
 * A customer who neither replied nor paid within ESCALATION_AFTER_MS of a
 * reminder gets one louder WhatsApp nudge, and the vendor is told to follow up
 * in person. Fires AT MOST ONCE per credit (guarded by escalatedAt), so the
 * total cost is capped at one extra message — this keeps WhatsApp quota under
 * control while still chasing silent debtors.
 *
 * "Answered" = replied or paid (reminderRespondedAt). We deliberately do NOT
 * depend on WhatsApp read receipts: many customers disable them, which would
 * make everyone look unread and escalate the whole book.
 */
export async function sendEscalations(scope: LifecycleScope = {}) {
  const now = scope.now ?? new Date();
  const cutoff = new Date(now.getTime() - ESCALATION_AFTER_MS);

  const stale = await prisma.credit.findMany({
    where: {
      ...(scope.vendorId ? { vendorId: scope.vendorId } : {}),
      status: { in: ["OUTSTANDING", "DUE_SOON", "OVERDUE"] },
      remindersEnabled: true,
      reminderSentAt: { not: null, lte: cutoff },
      reminderRespondedAt: null,
      escalatedAt: null,
      student: { whatsappBlockedAt: null, NOT: { phone: { startsWith: "pending:" } } },
    },
    include: { student: true, vendor: true },
    orderBy: { reminderSentAt: "asc" },
    take: 200, // bound each run so a backlog can't blow the CPU/quota budget
  });

  // Respect the merchant-level pre-due reminder switch — if they turned off
  // customer messaging, don't escalate either.
  const remindersAllowed = createReminderPrefResolver();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const credit of stale) {
    if (!(await remindersAllowed(credit.vendor.organizationId, "preDue"))) {
      skipped++;
      continue;
    }

    const owed = Number(credit.amount) - Number(credit.amountRepaid);
    const body = messages.escalationToCustomer(credit.student.fullName, credit.vendor.businessName, owed, payToBlock(credit.vendor));

    try {
      await sendCustomerReminder({
        phone: credit.student.phone,
        customerName: credit.student.fullName,
        shopName: credit.vendor.businessName,
        amountOwed: owed,
        dueText: "still unpaid — please settle today",
        richBody: body,
        now,
      });
      await prisma.credit.update({ where: { id: credit.id }, data: { escalatedAt: now } });
      await prisma.notification.create({
        data: {
          vendorId: credit.vendorId,
          title: "Customer not responding",
          message: `${credit.student.fullName} hasn't answered the reminder for ₦${owed.toLocaleString()}. We sent a firmer follow-up — you may want to reach out directly.`,
          type: "WARNING",
        },
      });
      sent++;
    } catch (err) {
      failed++;
      // A blocked / unreachable number: stop escalating and record it, same as
      // the pre-due path, so we never retry a dead number.
      if (err instanceof WhatsAppSendError && err.permanent) {
        // Say so — auto-blacklisting a customer silently makes "why did they
        // stop getting reminders?" unanswerable from the logs.
        console.warn(
          `[escalations] ${maskPhone(credit.student.phone)} unreachable (Meta code ${err.code ?? "?"}) — marking blocked`,
        );
        await prisma.student.update({ where: { id: credit.student.id }, data: { whatsappBlockedAt: now } }).catch(() => {});
        await prisma.credit.update({ where: { id: credit.id }, data: { escalatedAt: now } }).catch(() => {});
      } else {
        console.error(`[escalations] failed for credit ${credit.id}:`, err);
      }
    }
  }

  return { sent, failed, skipped, total: stale.length };
}
