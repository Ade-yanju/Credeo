import { NextResponse } from "next/server";
import { guardVendorWrite } from "@/lib/entitlement-guard";
import { markOverdueCredits, sendOverdueReminders } from "@/lib/credit-lifecycle";

// POST /api/vendor/remind-overdue
// Vendor-triggered: sends a WhatsApp reminder to every student with an OVERDUE credit.
export async function POST() {
  // sendOverdueReminders() already skips each item for a lapsed vendor
  // (credit-lifecycle.ts:234 checks isPlanActive regardless of `force`), so
  // this used to answer 200 with sent:0 — technically safe, but it looked
  // broken rather than gated. Guarding here turns that into an honest 403
  // with a renew prompt, and skips the markOverdueCredits writes we would
  // otherwise do for a vendor who cannot send anything.
  const guard = await guardVendorWrite("reminder.send");
  if (!guard.ok) return guard.response;
  const { vendor } = guard;

  await markOverdueCredits({ vendorId: vendor.id });
  const result = await sendOverdueReminders({ vendorId: vendor.id, force: true });

  if (result.total === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No overdue credits with reachable customers." });
  }

  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed, total: result.total });
}
