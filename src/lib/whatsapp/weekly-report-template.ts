import { normaliseTemplateName } from "@/lib/otp-delivery";

export const DEFAULT_WEEKLY_REPORT_TEMPLATE = "vodium_weekly_report";

export function resolveWeeklyReportTemplateName(): string {
  const configured = process.env.WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME;
  if (!configured) return DEFAULT_WEEKLY_REPORT_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_WEEKLY_REPORT_TEMPLATE;
}
