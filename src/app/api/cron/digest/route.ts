import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyDigests } from "@/lib/vendor-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/digest — weekly vendor ledger digest.
 *
 * Runs once a week (schedule lives in cron-job.org alongside the reminder and
 * daily jobs, guarded by the same CRON_SECRET). Sends each active vendor a short
 * WhatsApp summary of who is owing and who paid. See lib/vendor-digest.ts for
 * the delivery-window rules (vendors only get it inside an open session).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("[cron/digest] CRON_SECRET not set — refusing to run in production");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendWeeklyDigests();
  console.log(
    `[cron/digest] sent=${result.sent} skipped=${result.skipped} failed=${result.failed} total=${result.total}`,
  );
  return NextResponse.json({ ok: true, ...result });
}
