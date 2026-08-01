import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppDocument,
  sendWhatsAppDocumentTemplate,
  sendWhatsAppMessage,
  WhatsAppSendError,
} from "@/lib/whatsapp/outbound";
import { hasOpenSession } from "@/lib/whatsapp/reminder-delivery";
import { ensureInvoiceTemplate } from "@/lib/whatsapp/otp-template";
import { resolveInvoiceTemplateName } from "@/lib/whatsapp/invoice-template";
import { invoicePdfFilename } from "@/lib/invoice-pdf";

const TEMPLATE_UNUSABLE_CODES = new Set([132000, 132001, 132005, 132012, 132015, 132016]);
const TEMPLATE_RECHECK_MS = 10 * 60 * 1000;

let provisionAttempted = false;
let templateUnusableUntil = 0;

export type InvoiceDeliveryChannel = "session" | "template" | "freetext-fallback";

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
}): Promise<{ channel: InvoiceDeliveryChannel }> {
  const now = input.now ?? new Date();

  if (await hasOpenSession(input.phone, now)) {
    await sendWhatsAppDocument(
      input.phone,
      input.pdfLink,
      invoicePdfFilename(input.invoiceNumber),
      input.richBody,
      input.creds,
    );
    return { channel: "session" };
  }

  const template = resolveInvoiceTemplateName();
  const firstName = input.customerName.trim().split(/\s+/)[0] || input.customerName;
  const due = input.dueDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  if (Date.now() < templateUnusableUntil) {
    await sendWhatsAppMessage(input.phone, input.richBody, input.creds);
    return { channel: "freetext-fallback" };
  }

  try {
    await sendWhatsAppDocumentTemplate(
      input.phone,
      template,
      input.pdfLink,
      invoicePdfFilename(input.invoiceNumber),
      [firstName, input.shopName, input.invoiceNumber, formatNaira(input.total), due, input.link],
      { creds: input.creds, languageCode: process.env.WHATSAPP_INVOICE_TEMPLATE_LANG ?? "en_US" },
    );
    return { channel: "template" };
  } catch (err) {
    if (err instanceof WhatsAppSendError && err.code !== undefined && TEMPLATE_UNUSABLE_CODES.has(err.code)) {
      console.warn(`[invoice] template "${template}" unusable (Meta ${err.code}) — falling back to free text.`);
      if (err.code === 132001 && !provisionAttempted) {
        provisionAttempted = true;
        try {
          const result = await ensureInvoiceTemplate({ name: template });
          if (result.created) {
            console.log(`[invoice] auto-created template "${template}" (${result.status}) — used once Meta approves`);
          } else if (result.status) {
            console.log(`[invoice] template "${template}" exists with status ${result.status} — sends switch over once APPROVED`);
          } else if (result.detail) {
            console.warn(`[invoice] auto-create failed: ${result.detail}`);
          }
        } catch (provisionErr) {
          console.warn("[invoice] auto-create threw:", provisionErr);
        }
      }
      templateUnusableUntil = Date.now() + TEMPLATE_RECHECK_MS;
      await sendWhatsAppMessage(input.phone, input.richBody, input.creds);
      return { channel: "freetext-fallback" };
    }
    throw err;
  }
}
