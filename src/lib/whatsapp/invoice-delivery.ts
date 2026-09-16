/**
 * Vodium Ledger — invoice delivery on WhatsApp.
 *
 * An invoice has TWO things to deliver: the notification and the PDF itself.
 * Outside the 24-hour window only an approved template can carry the PDF (as a
 * DOCUMENT header), which is why this path depends on the invoice template
 * being approved AND on WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE being set.
 *
 * Invoice delivery is template-only. A missing or unapproved template is
 * reported as undelivered; it never downgrades to plain text or a raw document.
 */

import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppDocumentTemplate,
} from "@/lib/whatsapp/outbound";
import { ensureInvoiceTemplate } from "@/lib/whatsapp/otp-template";
import { resolveInvoiceTemplateName } from "@/lib/whatsapp/invoice-template";
import { invoicePdfFilename } from "@/lib/invoice-pdf";
import { deliverTemplateOnly } from "@/lib/whatsapp/session-window";

let provisionAttempted = false;

export type InvoiceDeliveryChannel =
  | "session"
  | "upgraded"
  | "template-only"
  | "freetext-fallback";

export async function sendCustomerInvoice(input: {
  phone: string;
  customerName: string;
  shopName: string;
  invoiceNumber: string;
  total: number;
  dueDate: Date;
  link: string;
  pdfLink: string;
  richBody: string;
  creds?: { token: string; phoneId: string };
  now?: Date;
}): Promise<{ channel: InvoiceDeliveryChannel; delivered: boolean; templateIssue?: string }> {
  const template = resolveInvoiceTemplateName();
  const firstName = input.customerName.trim().split(/\s+/)[0] || input.customerName;
  const due = input.dueDate.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const filename = invoicePdfFilename(input.invoiceNumber);

  const result = await deliverTemplateOnly({
    phone: input.phone,
    now: input.now,
    sendTemplate: () =>
      sendWhatsAppDocumentTemplate(
        input.phone,
        template,
        input.pdfLink,
        filename,
        [firstName, input.shopName, input.invoiceNumber, formatNaira(input.total), due, input.link],
        { creds: input.creds, languageCode: process.env.WHATSAPP_INVOICE_TEMPLATE_LANG ?? "en_US" },
      ),
    onTemplateUnusable: async (err) => {
      console.warn(`[invoice] template "${template}" unusable (Meta ${err.code}) — no plain-text fallback will be sent.`);
      if (err.code === 132001 && !provisionAttempted) {
        provisionAttempted = true;
        try {
          const r = await ensureInvoiceTemplate({ name: template });
          if (r.created) {
            console.log(`[invoice] auto-created template "${template}" (${r.status}) — used once Meta approves`);
          } else if (r.status) {
            console.log(`[invoice] template "${template}" exists with status ${r.status} — sends switch over once APPROVED`);
          } else if (r.detail) {
            console.warn(`[invoice] auto-create failed: ${r.detail}`);
          }
        } catch (provisionErr) {
          console.warn("[invoice] auto-create threw:", provisionErr);
        }
      }
      console.warn(
        `[invoice] PDF attachment will only reach out-of-session customers after template "${template}" is APPROVED in Meta.`,
      );
    },
  });

  return result;
}
