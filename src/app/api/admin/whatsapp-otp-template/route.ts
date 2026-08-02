import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { listOtpTemplates, ensureInvoiceTemplate, ensureOtpTemplate, ensureReminderTemplate } from "@/lib/whatsapp/otp-template";
import { resolveInvoiceTemplateName } from "@/lib/whatsapp/invoice-template";
import { resolveReminderTemplateName } from "@/lib/whatsapp/reminder-delivery";

export const dynamic = "force-dynamic";

// Same bar as the bot profile: only the super admin touches the platform's
// Meta configuration.
const CAN_MANAGE = ["SUPER_ADMIN"];

function findTemplate(
  templates: Array<{ name: string; status: string; language: string; category: string }>,
  name: string,
) {
  return templates.find((template) => template.name.toLowerCase() === name.toLowerCase());
}

// GET — which template OTP sending will use, and whether it exists/is approved.
export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_MANAGE.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await listOtpTemplates();
  const reminderName = resolveReminderTemplateName();
  const reminderTemplate = findTemplate(status.templates, reminderName);
  const invoiceName = resolveInvoiceTemplateName();
  const invoiceTemplate = findTemplate(status.templates, invoiceName);
  const invoiceDetail = invoiceTemplate
    ? undefined
    : "Create this DOCUMENT template in Meta, or set WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE from an uploaded sample PDF and click Create templates.";
  return NextResponse.json({
    ...status,
    reminder: { name: reminderName, status: reminderTemplate?.status },
    invoice: { name: invoiceName, status: invoiceTemplate?.status, detail: invoiceDetail },
  });
}

// POST — create the OTP template if missing. Idempotent: an existing template
// is reported untouched, so this can never break a working setup.
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

  // One click sets up BOTH templates: the OTP (authentication) one and the
  // payment-reminder (utility) one that reaches out-of-session customers.
  const reminder = await ensureReminderTemplate({ name: resolveReminderTemplateName() });
  if (reminder.detail) console.error("[admin/otp-template] reminder template:", reminder.detail);
  const invoice = await ensureInvoiceTemplate({ name: resolveInvoiceTemplateName() });
  if (invoice.detail) console.error("[admin/otp-template] invoice template:", invoice.detail);

  return NextResponse.json({ ...result, reminder, invoice });
}
