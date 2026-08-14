/**
 * Vodium Ledger — reminder delivery that actually reaches the customer.
 *
 * THE TRAP THIS SOLVES (found in production): Meta's API *accepts* a free-text
 * message to any number and returns success — but if that customer has no open
 * 24-hour session (they haven't messaged the bot recently), the message is
 * silently dropped. The delivery failure only arrives later as an async status
 * webhook. Our cron dutifully logged sent=1, stamped reminderSentAt, and the
 * customer received nothing.
 *
 * Strategy: always use the approved UTILITY template. This makes reminders
 * compliant whether or not the customer has an open session, and avoids an
 * ambiguous free-text fallback that Meta could reject asynchronously.
 */

import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppTemplate,
  type WhatsAppButton,
} from "@/lib/whatsapp/outbound";
import { normaliseTemplateName } from "@/lib/otp-delivery";
import { ensureReminderTemplate } from "@/lib/whatsapp/otp-template";
import { isTemplateUnusable } from "@/lib/whatsapp/session-window";

export const DEFAULT_REMINDER_TEMPLATE = "vodium_payment_reminder";

/** One creation attempt per warm instance — Meta treats repeats as duplicates anyway. */
let provisionAttempted = false;

export function resolveReminderTemplateName(): string {
  const configured = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME;
  if (!configured) return DEFAULT_REMINDER_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_REMINDER_TEMPLATE;
}

export type ReminderChannel = "template";

/**
 * Send a payment reminder that actually reaches the customer.
 *
 * Always sends the approved UTILITY template. This intentionally avoids plain
 * text and interactive-message fallbacks, so a reminder has one compliant
 * delivery path regardless of the customer's session state.
 *
 * Throws WhatsAppSendError like the raw senders do, so callers keep their
 * existing blocked/permanent handling.
 */
export async function sendCustomerReminder(input: {
  phone: string;
  customerName: string;
  shopName: string;
  amountOwed: number;
  /** Standalone phrase: "due in 30 minutes", "overdue by 2 days". */
  dueText: string;
  /** Retained for call-site compatibility; template copy is managed in Meta. */
  richBody: string;
  /** Retained for call-site compatibility; templates cannot carry reply buttons. */
  buttons?: WhatsAppButton[];
  creds?: { token: string; phoneId: string };
  now?: Date;
}): Promise<{ channel: ReminderChannel }> {
  const { phone, customerName, shopName, amountOwed, dueText, creds } = input;

  const template = resolveReminderTemplateName();
  const firstName = customerName.trim().split(/\s+/)[0] || customerName;

  try {
    await sendWhatsAppTemplate(phone, template, [firstName, shopName, formatNaira(amountOwed), dueText], {
      creds,
      languageCode: process.env.WHATSAPP_REMINDER_TEMPLATE_LANG ?? "en_US",
    });
    return { channel: "template" };
  } catch (err) {
    if (isTemplateUnusable(err)) {
      console.warn(
        `[reminder] template "${template}" unusable (Meta ${err.code}) — reminder will not be sent.`,
      );
      // Self-provision: a 132001 means the template simply doesn't exist yet.
      // Create it now (idempotent, once per instance) so the NEXT reminder run
      // delivers out-of-session — no admin click required.
      if (err.code === 132001 && !provisionAttempted) {
        provisionAttempted = true;
        try {
          const r = await ensureReminderTemplate({ name: template });
          if (r.created) {
            console.log(`[reminder] auto-created template "${template}" (${r.status}) — used once Meta approves`);
          } else if (r.status) {
            // Exists but Meta still 132001s it → almost certainly PENDING
            // review (Meta uses the same error for unapproved templates).
            console.log(`[reminder] template "${template}" exists with status ${r.status} — sends switch over once APPROVED`);
          } else if (r.detail) {
            console.warn(`[reminder] auto-create failed: ${r.detail}`);
          }
        } catch (provisionErr) {
          console.warn("[reminder] auto-create threw:", provisionErr);
        }
      }
    }
    throw err;
  }
}
