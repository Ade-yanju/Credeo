/**
 * POST /api/admin/blast-reminders — customer care's "send reminders now".
 *
 * Immediately re-sends WhatsApp reminders for every OVERDUE credit,
 * bypassing the 3-day repeat interval (force). Delivery is session-aware, so
 * out-of-session customers get the approved template. Rate-limited to one
 * blast per 10 minutes platform-wide so a double-click can't double-message
 * every debtor.
 */

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { sendOverdueReminders } from "@/lib/credit-lifecycle";
import { rateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";

const CAN_BLAST = ["SUPER_ADMIN", "CUSTOMER_CARE"];

export async function POST() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_BLAST.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = await rateLimit("rl:admin-blast-reminders", 1, 600, true);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "A blast was already sent in the last 10 minutes. Give customers a moment before the next one." },
      { status: 429 },
    );
  }

  const result = await sendOverdueReminders({ force: true });
  console.log(
    `[admin/blast-reminders] by=${session.id} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
  );
  return NextResponse.json(result);
}
