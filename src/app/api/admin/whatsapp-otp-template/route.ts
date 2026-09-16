import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import {
  invoiceTemplateVisibilityDetail,
  listOtpTemplates,
  ensureInvoiceTemplate,
  ensureOtpTemplate,
  ensureReminderTemplate,
  ensureCreditLoggedTemplate,
  ensureWeeklyReportTemplate,
  ensureVendorDigestTemplate,
  ensureSubscriptionNudgeTemplate,
} from "@/lib/whatsapp/otp-template";
import { resolveInvoiceTemplateName } from "@/lib/whatsapp/invoice-template";
import { resolveReminderTemplateName } from "@/lib/whatsapp/reminder-delivery";
import { resolveCreditLoggedTemplateName } from "@/lib/whatsapp/credit-logged-template";
import { resolveWeeklyReportTemplateName } from "@/lib/whatsapp/weekly-report-template";
import { resolveVendorDigestTemplateName } from "@/lib/whatsapp/vendor-digest-template";
import { resolveSubscriptionNudgeTemplateName } from "@/lib/whatsapp/subscription-nudge-template";

export const dynamic = "force-dynamic";

// Same bar as the bot profile: only the super admin touches the platform's
// Meta configuration.
const CAN_MANAGE = ["SUPER_ADMIN"];

function normalizeTemplateName(name: string) {
  return name.trim().toLowerCase();
}

function findTemplate(
  templates: Array<{ name: string; status: string; language: string; category: string }>,
  name: string,
) {
  const target = normalizeTemplateName(name);
  return templates
    .filter((template) => normalizeTemplateName(template.name) === target)
    .sort((a, b) => templateStatusRank(b.status) - templateStatusRank(a.status))[0];
}

function templateStatusRank(status?: string): number {
  const normalized = status?.trim().toUpperCase() ?? "";
  if (normalized === "APPROVED" || normalized === "ACTIVE" || normalized.startsWith("ACTIVE ") || normalized.startsWith("ACTIVE-") || normalized.startsWith("ACTIVE_")) return 3;
  if (normalized === "PENDING") return 2;
  return 1;
}

function templateState(
  templates: Array<{ name: string; status: string; language: string; category: string }>,
  name: string,
) {
  const template = findTemplate(templates, name);
  return {
    name,
    status: template?.status,
    language: template?.language,
    category: template?.category,
  };
}

// GET — required platform templates and whether each exists/is approved.
export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_MANAGE.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await listOtpTemplates();
  const reminderName = resolveReminderTemplateName();
  const reminderTemplate = findTemplate(status.templates, reminderName);
  const creditLoggedName = resolveCreditLoggedTemplateName();
  const creditLoggedTemplate = findTemplate(status.templates, creditLoggedName);
  const invoiceName = resolveInvoiceTemplateName();
  const invoiceTemplate = findTemplate(status.templates, invoiceName);
  const invoiceDetail = invoiceTemplate ? undefined : invoiceTemplateVisibilityDetail(status.templates, invoiceName);
  const weeklyReportName = resolveWeeklyReportTemplateName();
  const vendorDigestName = resolveVendorDigestTemplateName();
  const subscriptionNudgeName = resolveSubscriptionNudgeTemplateName();
  return NextResponse.json({
    ...status,
    reminder: { name: reminderName, status: reminderTemplate?.status, language: reminderTemplate?.language, category: reminderTemplate?.category },
    creditLogged: { name: creditLoggedName, status: creditLoggedTemplate?.status, language: creditLoggedTemplate?.language, category: creditLoggedTemplate?.category },
    invoice: { name: invoiceName, status: invoiceTemplate?.status, language: invoiceTemplate?.language, category: invoiceTemplate?.category, detail: invoiceDetail },
    weeklyReport: templateState(status.templates, weeklyReportName),
    vendorDigest: templateState(status.templates, vendorDigestName),
    subscriptionNudge: templateState(status.templates, subscriptionNudgeName),
  });
}

// POST — provision every required platform template if missing. Idempotent:
// existing templates are reported untouched, so this cannot break a working
// setup.
export async function POST() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_MANAGE.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await ensureOtpTemplate();
  if (result.detail && !result.active) {
    // Log server-side too — a 502 with "no logs for this request" is
    // undiagnosable from the Vercel dashboard.
    console.error("[admin/otp-template] setup failed:", result.detail);
    return NextResponse.json({ error: result.detail, ...result }, { status: 502 });
  }

  // One click sets up the complete automated-delivery template set.
  const reminder = await ensureReminderTemplate({ name: resolveReminderTemplateName() });
  if (reminder.detail) console.error("[admin/otp-template] reminder template:", reminder.detail);
  const creditLogged = await ensureCreditLoggedTemplate({ name: resolveCreditLoggedTemplateName() });
  if (creditLogged.detail) console.error("[admin/otp-template] credit logged template:", creditLogged.detail);
  const invoice = await ensureInvoiceTemplate({ name: resolveInvoiceTemplateName() });
  if (invoice.detail) console.error("[admin/otp-template] invoice template:", invoice.detail);
  const weeklyReport = await ensureWeeklyReportTemplate({ name: resolveWeeklyReportTemplateName() });
  if (weeklyReport.detail) console.error("[admin/otp-template] weekly report template:", weeklyReport.detail);
  const vendorDigest = await ensureVendorDigestTemplate({ name: resolveVendorDigestTemplateName() });
  if (vendorDigest.detail) console.error("[admin/otp-template] vendor digest template:", vendorDigest.detail);
  const subscriptionNudge = await ensureSubscriptionNudgeTemplate({ name: resolveSubscriptionNudgeTemplateName() });
  if (subscriptionNudge.detail) console.error("[admin/otp-template] subscription nudge template:", subscriptionNudge.detail);

  return NextResponse.json({ ...result, reminder, creditLogged, invoice, weeklyReport, vendorDigest, subscriptionNudge });
}
