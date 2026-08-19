import { NextRequest, NextResponse } from "next/server";
import { runWeeklyReports } from "@/lib/weekly-report-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/weekly-report — Monday-morning vendor report.
 *
 * Covers the calendar week just ended (Mon–Sun, Africa/Lagos) and sends each
 * qualifying vendor a PDF over WhatsApp. Vendors who logged no credit that week,
 * and vendors whose account is locked, are skipped by design.
 *
 * Schedule lives in cron-job.org alongside the reminder, daily and digest jobs,
 * guarded by the same CRON_SECRET. Run it any day of the week and it still
 * reports the last COMPLETE week, so a retry is safe.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV === "production") {
    console.error("[cron/weekly-report] CRON_SECRET not set — refusing to run in production");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runWeeklyReports();
  console.log(
    `[cron/weekly-report] week=${result.weekStart.slice(0, 10)} candidates=${result.candidates} ` +
    `sent=${result.sent} undelivered=${result.undelivered} skipped=${result.skipped} failed=${result.failed}`,
  );
  return NextResponse.json({ ok: true, ...result });
}
