/**
 * Vodium Ledger — invoice delivery on WhatsApp.
 *
 * An invoice has TWO things to deliver: the notification and the PDF itself.
 * Outside the 24-hour window only an approved template can carry the PDF (as a
 * DOCUMENT header), which is why this path depends on the invoice template
 * being approved AND on WHATSAPP_INVOICE_TEMPLATE_HEADER_HANDLE being set.
 *
 * When the template works we now also send the rich follow-up (link, balance,
 * "I've paid" button) inside the window the template just opened — see
 * session-window.ts. When it does not, the customer still gets the free-text
 * message, but ONLY if a window happens to be open; the caller is told so via
 * `delivered: false` instead of being allowed to assume success.
 */

import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppDocument,
  sendWhatsAppDocumentTemplate,
  sendWhatsAppMessage,
} from "@/lib/whatsapp/outbound";
import { ensureInvoiceTemplate } from "@/lib/whatsapp/otp-template";
import { resolveInvoiceTemplateName } from "@/lib/whatsapp/invoice-template";
import { invoicePdfFilename } from "@/lib/invoice-pdf";
import { deliverThenUpgrade } from "@/lib/whatsapp/session-window";

const TEMPLATE_RECHECK_MS = 10 * 60 * 1000;

let provisionAttempted = false;
let templateUnusableUntil = 0;

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

  const result = await deliverThenUpgrade({
    phone: input.phone,
    now: input.now,
    skipTemplate: Date.now() < templateUnusableUntil,
    sendTemplate: () =>
      sendWhatsAppDocumentTemplate(
        input.phone,
        template,
        input.pdfLink,
        filename,
        [firstName, input.shopName, input.invoiceNumber, formatNaira(input.total), due, input.link],
        { creds: input.creds, languageCode: process.env.WHATSAPP_INVOICE_TEMPLATE_LANG ?? "en_US" },
      ),
    // In-session (or in the window the template just opened) we can attach the
    // PDF directly as a plain document — no template needed. That is the whole
    // reason the upgrade step is worth doing for invoices: the customer gets a
    // real attachment rather than only a link.
    sendRich: async () => {
      await sendWhatsAppDocument(
        input.phone,
        input.pdfLink,
        filename,
        input.richBody.slice(0, 1024),
        input.creds,
      );
    },
    onTemplateUnusable: async (err) => {
      console.warn(`[invoice] template "${template}" unusable (Meta ${err.code}) — falling back to free text.`);
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
      templateUnusableUntil = Date.now() + TEMPLATE_RECHECK_MS;
      console.warn(
        `[invoice] PDF attachment will only reach out-of-session customers after template "${template}" is APPROVED in Meta.`,
      );
    },
  });

  // If even the document fallback is impossible we still want the text to go
  // out, so the customer at least gets the link.
  if (result.channel === "freetext-fallback") {
    try {
      await sendWhatsAppMessage(input.phone, input.richBody, input.creds);
    } catch (err) {
      console.warn("[invoice] free-text fallback failed:", err instanceof Error ? err.message : err);
    }
  }

  return result;
}
