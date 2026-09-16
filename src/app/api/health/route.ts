import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — machine-readable status for an uptime monitor.
 *
 * Built because breakage was reaching vendors before we knew about it. Point
 * any uptime service (UptimeRobot, BetterStack, Vercel monitors) at this and
 * alert on a non-200; it answers "is the platform actually working?" rather
 * than merely "does the site return HTML?".
 *
 * Deliberately leaks nothing: no counts, names, or amounts — only whether each
 * dependency is reachable and whether the reminder pipeline looks alive.
 * Returns 200 when healthy, 503 when something needs attention.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // 1. Database — everything depends on it.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "unreachable";
    healthy = false;
  }

  // 2. Redis — used for rate limiting and webhook de-duplication. Its absence
  //    degrades safety (login limiting fails closed) but isn't fatal.
  const redis = getRedis();
  if (!redis) {
    checks.redis = "not_configured";
  } else {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "unreachable";
      healthy = false;
    }
  }

  // 3. WhatsApp credentials — without these the bot is mute and no reminder,
  //    invoice or verification code can leave the building.
  checks.whatsapp =
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
      ? "configured"
      : "missing_credentials";
  if (checks.whatsapp !== "configured") healthy = false;

  // 4. Is the reminder pipeline alive? If credits are sitting due within the
  //    next day and NOTHING has been reminded for over 48 hours, the cron has
  //    almost certainly stopped — the exact failure vendors reported.
  try {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [dueSoon, recentlyReminded] = await Promise.all([
      prisma.credit.count({
        where: {
          status: { in: ["OUTSTANDING", "DUE_SOON"] },
          dueDate: { lte: soon, gte: new Date() },
          remindersEnabled: true,
          reminderSentAt: null,
        },
      }),
      prisma.credit.count({ where: { reminderSentAt: { gte: twoDaysAgo } } }),
    ]);

    if (dueSoon > 0 && recentlyReminded === 0) {
      checks.reminders = "stalled";
      healthy = false;
    } else {
      checks.reminders = "ok";
    }
  } catch {
    checks.reminders = "unknown";
  }

  // 5. Template outbox — scheduled messages must not sit pending forever.
  try {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const stale = await prisma.whatsAppOutboxMessage.count({
      where: {
        OR: [
          { status: "PENDING", availableAt: { lt: staleBefore } },
          { status: "PROCESSING", updatedAt: { lt: staleBefore } },
        ],
      },
    });
    checks.whatsappOutbox = stale > 0 ? "stalled" : "ok";
    if (stale > 0) healthy = false;
  } catch {
    checks.whatsappOutbox = "unknown";
  }

  return NextResponse.json(
    { ok: healthy, checks, at: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
