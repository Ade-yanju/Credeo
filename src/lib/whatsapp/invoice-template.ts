import { normaliseTemplateName } from "@/lib/otp-delivery";

export const DEFAULT_INVOICE_TEMPLATE = "vodium_invoice_pdf";

export function resolveInvoiceTemplateName(): string {
  const configured = process.env.WHATSAPP_INVOICE_TEMPLATE_NAME;
  if (!configured) return DEFAULT_INVOICE_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_INVOICE_TEMPLATE;
}
