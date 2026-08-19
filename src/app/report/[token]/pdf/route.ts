/**
 * Public weekly-report PDF.
 *
 * PUBLIC BY NECESSITY: when we send the report as a WhatsApp document template,
 * Meta's servers fetch this URL themselves — there is no vendor session on that
 * request. Access is therefore controlled by the HMAC in the token
 * (signReportToken in lib/bnpl-token.ts), exactly as the invoice PDF at
 * app/invoice/[token]/pdf does.
 *
 * The token pins BOTH the vendor and the week, so it cannot be edited to read
 * another shop's book or a different period.
 */

import { NextResponse } from "next/server";
import { verifyReportToken } from "@/lib/bnpl-token";
import { buildWeeklyReport } from "@/lib/weekly-report";
import { generateWeeklyReportPdf, weeklyReportPdfFilename } from "@/lib/weekly-report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const parsed = verifyReportToken(params.token);
  if (!parsed) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const weekEnd = new Date(parsed.weekStart.getTime() + 7 * 86_400_000 - 1);

  const data = await buildWeeklyReport({
    vendorId: parsed.vendorId,
    weekStart: parsed.weekStart,
    weekEnd,
  });

  // Null means the vendor logged nothing that week, or their account is locked.
  // Both are legitimately "no report", not an error worth alarming anyone with.
  if (!data) return NextResponse.json({ error: "No report for that week." }, { status: 404 });

  const pdf = await generateWeeklyReportPdf(data);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${weeklyReportPdfFilename(data.shopName, data.weekStart)}"`,
      "Content-Length": String(pdf.length),
      // A finished week never changes, so this is safe to cache hard — and Meta
      // may fetch the same URL more than once per send.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
