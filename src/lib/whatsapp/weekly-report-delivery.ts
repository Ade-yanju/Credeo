/**
 * Vodium Ledger — weekly report delivery on WhatsApp.
 *
 * The report is a PDF, and outside the 24-hour window only an approved template
 * can carry a document. That is the whole reason this path exists rather than a
 * plain free-text send: most vendors will not happen to have messaged the bot in
 * the last day when the Monday cron fires, and a report nobody receives is worse
 * than no report.
 *
 * HONEST DEGRADATION: if the template is missing or not yet APPROVED, this
 * reports `delivered: false` rather than pretending. It does NOT fall back to a
 * free-text summary — the vendor was promised a report, and a silent downgrade
 * to a text message would look like the PDF feature is broken.
 *
 * Mirrors lib/whatsapp/invoice-delivery.ts, including its template-unusable
 * back-off, so both document paths behave the same way under the same failures.
 */

import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppDocument,
  sendWhatsAppDocumentTemplate,
} from "@/lib/whatsapp/outbound";
import { ensureWeeklyReportTemplate } from "@/lib/whatsapp/otp-template";
import { resolveWeeklyReportTemplateName } from "@/lib/whatsapp/weekly-report-template";
import { deliverThenUpgrade, type DeliveryResult } from "@/lib/whatsapp/session-window";
import { weeklyReportPdfFilename } from "@/lib/weekly-report-pdf";
import { formatWeekRange, type WeeklyReportData } from "@/lib/weekly-report";

const TEMPLATE_RECHECK_MS = 10 * 60 * 1000;

let provisionAttempted = false;
let templateUnusableUntil = 0;

/** Reuses the shared delivery shape so the two document paths cannot drift. */
export type WeeklyReportDelivery = DeliveryResult;

export async function sendWeeklyReport(input: {
  data: WeeklyReportData;
  pdfLink: string;
  creds?: { token: string; phoneId: string };
  now?: Date;
}): Promise<WeeklyReportDelivery> {
  const { data } = input;
  const template = resolveWeeklyReportTemplateName();
  const firstName = data.ownerName.trim().split(/\s+/)[0] || data.ownerName;
  const range = formatWeekRange(data.weekStart, data.weekEnd);
  const filename = weeklyReportPdfFilename(data.shopName, data.weekStart);

  const caption =
    `📊 *Your week on Vodium Ledger*\n${range}\n\n` +
    `Credit given out: ${formatNaira(data.creditsLoggedTotal)} (${data.creditsLoggedCount})\n` +
    `Money received: ${formatNaira(data.amountReceivedTotal)}\n` +
    `Still owing you: ${formatNaira(data.closingOutstanding)}`;

  const result = await deliverThenUpgrade({
    phone: data.phone,
    now: input.now,
    skipTemplate: Date.now() < templateUnusableUntil,
    sendTemplate: () =>
      sendWhatsAppDocumentTemplate(
        data.phone,
        template,
        input.pdfLink,
        filename,
        [
          firstName,
          range,
          formatNaira(data.creditsLoggedTotal),
          formatNaira(data.amountReceivedTotal),
          formatNaira(data.closingOutstanding),
        ],
        { creds: input.creds, languageCode: process.env.WHATSAPP_WEEKLY_REPORT_TEMPLATE_LANG ?? "en_US" },
      ),
    // In-session (or in the window the template just opened) the PDF can go as
    // a plain document with a richer caption — no template needed.
    sendRich: async () => {
      await sendWhatsAppDocument(data.phone, input.pdfLink, filename, caption.slice(0, 1024), input.creds);
    },
    onTemplateUnusable: async (err) => {
      console.warn(`[weekly-report] template "${template}" unusable (Meta ${err.code}) — vendor ${data.vendorId} may not receive this week's PDF.`);
      if (err.code === 132001 && !provisionAttempted) {
        provisionAttempted = true;
        try {
          const r = await ensureWeeklyReportTemplate({ name: template });
          if (r.created) {
            console.log(`[weekly-report] auto-created template "${template}" (${r.status}) — used once Meta approves`);
          } else if (r.status) {
            console.log(`[weekly-report] template "${template}" exists with status ${r.status} — sends switch over once APPROVED`);
          } else if (r.detail) {
            console.warn(`[weekly-report] auto-create failed: ${r.detail}`);
          }
        } catch (provisionErr) {
          console.warn("[weekly-report] auto-create threw:", provisionErr);
        }
      }
      templateUnusableUntil = Date.now() + TEMPLATE_RECHECK_MS;
      console.warn(
        `[weekly-report] PDFs will only reach out-of-session vendors after template "${template}" is APPROVED in Meta.`,
      );
    },
  });

  return result;
}
