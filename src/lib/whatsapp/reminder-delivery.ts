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
 * Strategy: we already know whether a session is open — the webhook upserts
 * WhatsAppSession.lastInteractionAt for every inbound sender, customers
 * included. So:
 *
 *   - session open  → rich free-text/buttons (bank details, "I've paid" etc.)
 *   - session closed → approved UTILITY template — the only thing Meta
 *     guarantees to deliver outside a session
 *   - template missing/unapproved → fall back to the rich message (previous
 *     behaviour: delivered in-session, dropped outside — better than nothing)
 */

import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/utils";
import {
  sendWhatsAppButtons,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  WhatsAppSendError,
  type WhatsAppButton,
} from "@/lib/whatsapp/outbound";
import { normaliseTemplateName } from "@/lib/otp-delivery";
import { ensureReminderTemplate } from "@/lib/whatsapp/otp-template";

/** One hour under Meta's 24 so we never race the window's expiry mid-send. */
const SESSION_OPEN_MS = 23 * 60 * 60 * 1000;

export const DEFAULT_REMINDER_TEMPLATE = "vodium_payment_reminder";

/** Meta codes meaning "this template can't be used" — fall back, don't give up. */
const TEMPLATE_UNUSABLE_CODES = new Set([132000, 132001, 132005, 132012, 132015, 132016]);

/** One creation attempt per warm instance — Meta treats repeats as duplicates anyway. */
let provisionAttempted = false;

export function resolveReminderTemplateName(): string {
  const configured = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME;
  if (!configured) return DEFAULT_REMINDER_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_REMINDER_TEMPLATE;
}

export async function hasOpenSession(phone: string, now: Date = new Date()): Promise<boolean> {
  const session = await prisma.whatsAppSession.findUnique({
    where: { phone },
    select: { lastInteractionAt: true },
  });
  return Boolean(session && now.getTime() - session.lastInteractionAt.getTime() < SESSION_OPEN_MS);
}

export type ReminderChannel = "session" | "template" | "freetext-fallback";

/**
 * Send a payment reminder, choosing the channel that will actually deliver.
 * Throws WhatsAppSendError like the raw senders do — callers keep their
 * existing blocked/permanent handling.
 */
export async function sendCustomerReminder(input: {
  phone: string;
  customerName: string;
  shopName: string;
  amountOwed: number;
  /** Standalone phrase: "due in 30 minutes", "overdue by 2 days". */
  dueText: string;
  /** The rich in-session message (bank details, score nudge, …). */
  richBody: string;
  buttons?: WhatsAppButton[];
  creds?: { token: string; phoneId: string };
  now?: Date;
}): Promise<{ channel: ReminderChannel }> {
  const { phone, customerName, shopName, amountOwed, dueText, richBody, buttons, creds } = input;
  const now = input.now ?? new Date();

  const sendRich = async () => {
    if (buttons?.length) await sendWhatsAppButtons(phone, richBody, buttons, creds);
    else await sendWhatsAppMessage(phone, richBody, creds);
  };

  if (await hasOpenSession(phone, now)) {
    await sendRich();
    return { channel: "session" };
  }

  const template = resolveReminderTemplateName();
  const firstName = customerName.trim().split(/\s+/)[0] || customerName;
  try {
    await sendWhatsAppTemplate(
      phone,
      template,
      [firstName, shopName, formatNaira(amountOwed), dueText],
      { creds, languageCode: process.env.WHATSAPP_REMINDER_TEMPLATE_LANG ?? "en_US" },
    );
    return { channel: "template" };
  } catch (err) {
    if (err instanceof WhatsAppSendError && err.code !== undefined && TEMPLATE_UNUSABLE_CODES.has(err.code)) {
      console.warn(
        `[reminder] template "${template}" unusable (Meta ${err.code}) — falling back to free text.`,
      );
      // Self-provision: a 132001 means the template simply doesn't exist yet.
      // Create it now (idempotent, once per instance) so the NEXT reminder run
      // delivers out-of-session — no admin click required.
      if (err.code === 132001 && !provisionAttempted) {
        provisionAttempted = true;
        try {
          const r = await ensureReminderTemplate({ name: template });
          if (r.created) console.log(`[reminder] auto-created template "${template}" (${r.status}) — used once Meta approves`);
          else if (r.detail) console.warn(`[reminder] auto-create failed: ${r.detail}`);
        } catch (provisionErr) {
          console.warn("[reminder] auto-create threw:", provisionErr);
        }
      }
      await sendRich();
      return { channel: "freetext-fallback" };
    }
    throw err; // recipient-level failures (blocked, not on WhatsApp) keep their meaning
  }
}
