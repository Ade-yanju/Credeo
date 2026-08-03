/**
 * Vodium Ledger — the 24-hour WhatsApp window, in one place.
 *
 * ── The rule ──────────────────────────────────────────────────────────
 * Meta only delivers a business-initiated message to a customer who has NOT
 * messaged the bot in the last 24 hours if it is an APPROVED TEMPLATE.
 * Free text sent outside that window is ACCEPTED by the API (HTTP 200, real
 * message id) and then silently dropped. There is no bypass, and being a
 * verified business does not grant one — verification affects display name,
 * messaging tier and template *eligibility*, never the window itself.
 *
 * ── Why this module exists ────────────────────────────────────────────
 * The old code treated template-vs-rich as either/or: try the template, and on
 * failure fall back to free text (which is exactly the silently-dropped path).
 * That throws away the most useful property of a template:
 *
 *   A DELIVERED TEMPLATE RE-OPENS THE 24-HOUR WINDOW.
 *
 * So the correct shape is not "template OR rich" but "template THEN rich":
 * send the approved template to re-open the window, then immediately send the
 * rich interactive message (buttons, bank details, PDF) inside the window it
 * just opened. The customer gets the full experience even though they had not
 * messaged us in weeks.
 *
 * ── The three cases ───────────────────────────────────────────────────
 *   session open       → send rich directly (no template needed, no cost)
 *   session closed     → template (opens window) → rich  ["upgraded"]
 *   template unusable  → template-only or rich-only, honestly reported
 *
 * Callers get back a channel describing what actually happened, so cron jobs
 * can log real delivery rather than assuming success.
 */

import { WhatsAppSendError } from "@/lib/whatsapp/outbound";

/**
 * One hour under Meta's 24 so we never race the window's expiry mid-send:
 * a session that looks open at 23h59m can close before the second message
 * lands, which would silently drop the rich follow-up.
 */
export const SESSION_OPEN_MS = 23 * 60 * 60 * 1000;

/** Meta codes meaning "this template can't be used" — fall back, don't give up. */
export const TEMPLATE_UNUSABLE_CODES = new Set([132000, 132001, 132005, 132012, 132015, 132016]);

export function isTemplateUnusable(err: unknown): err is WhatsAppSendError {
  return (
    err instanceof WhatsAppSendError &&
    err.code !== undefined &&
    TEMPLATE_UNUSABLE_CODES.has(err.code)
  );
}

/**
 * Is there an open 24-hour session with this number?
 *
 * Reads the same WhatsAppSession row the inbound webhook upserts on every
 * customer message, so it reflects real inbound activity.
 */
export async function hasOpenSession(phone: string, now: Date = new Date()): Promise<boolean> {
  // Lazy import: this module's ordering logic must stay importable without a
  // database (unit tests), so Prisma is only loaded on the DB-dependent paths.
  const { prisma } = await import("@/lib/prisma");
  const session = await prisma.whatsAppSession.findUnique({
    where: { phone },
    select: { lastInteractionAt: true },
  });
  return Boolean(session && now.getTime() - session.lastInteractionAt.getTime() < SESSION_OPEN_MS);
}

/**
 * Record that WE opened a window by delivering a template.
 *
 * Without this, a run that sends 3 templates to the same customer would think
 * the session was still closed each time and send 3 templates instead of
 * template-then-rich. Stamping it keeps `hasOpenSession` honest about windows
 * the platform opened itself, not just ones the customer opened.
 *
 * Never throws: failing to record a window must not fail a delivered message.
 */
export async function markWindowOpened(phone: string, now: Date = new Date()): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.whatsAppSession.upsert({
      where: { phone },
      update: { lastInteractionAt: now },
      create: { phone, state: "IDLE", context: {}, lastInteractionAt: now },
    });
  } catch (err) {
    console.warn(
      `[window] could not stamp session for ${phone}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * What actually happened, for logging and metrics.
 *
 *   session            — window was already open; rich sent directly
 *   upgraded           — template opened the window, then rich was delivered
 *   template-only      — template delivered, but the rich follow-up failed
 *   freetext-fallback  — no usable template; free text sent (delivers ONLY if
 *                        a window happens to be open — may be silently dropped)
 */
export type DeliveryChannel = "session" | "upgraded" | "template-only" | "freetext-fallback";

export interface DeliveryResult {
  channel: DeliveryChannel;
  /** True when the message is guaranteed to have reached the customer. */
  delivered: boolean;
  /** Set when the template could not be used, for admin surfacing. */
  templateIssue?: string;
}

/**
 * Deliver a message that must reach the customer regardless of session state.
 *
 * @param sendTemplate Sends the approved template. Should throw WhatsAppSendError.
 * @param sendRich     Sends the rich free-text/buttons/document message.
 * @param onTemplateUnusable Optional hook to self-provision a missing template.
 */
export async function deliverThenUpgrade(input: {
  phone: string;
  sendTemplate: () => Promise<void>;
  sendRich: () => Promise<void>;
  onTemplateUnusable?: (err: WhatsAppSendError) => Promise<void>;
  /** Skip the template attempt entirely (e.g. known-unusable, cached). */
  skipTemplate?: boolean;
  now?: Date;
  /**
   * Test seams. Production callers omit both: session state comes from the
   * database and a delivered template stamps the session. Injecting them keeps
   * the ordering logic unit-testable without a database.
   */
  isSessionOpen?: (phone: string, now: Date) => Promise<boolean>;
  onWindowOpened?: (phone: string, now: Date) => Promise<void>;
}): Promise<DeliveryResult> {
  const now = input.now ?? new Date();
  const checkSession = input.isSessionOpen ?? hasOpenSession;
  const stampWindow = input.onWindowOpened ?? markWindowOpened;

  // Case 1 — window already open. Rich message delivers on its own; sending a
  // template here would cost money and add a redundant notification.
  if (await checkSession(input.phone, now)) {
    await input.sendRich();
    return { channel: "session", delivered: true };
  }

  // Case 3 (short-circuit) — template known unusable; free text is all we have.
  if (input.skipTemplate) {
    await input.sendRich();
    return {
      channel: "freetext-fallback",
      delivered: false,
      templateIssue: "Template unusable; free text may be dropped outside the 24-hour window.",
    };
  }

  // Case 2 — closed window. Template first to re-open it.
  try {
    await input.sendTemplate();
  } catch (err) {
    if (isTemplateUnusable(err)) {
      if (input.onTemplateUnusable) {
        try {
          await input.onTemplateUnusable(err);
        } catch (hookErr) {
          console.warn("[window] template-provision hook threw:", hookErr);
        }
      }
      await input.sendRich();
      return {
        channel: "freetext-fallback",
        delivered: false,
        templateIssue: `Meta ${err.code}: template unusable — free text may be silently dropped.`,
      };
    }
    // Recipient-level failures (blocked, not on WhatsApp) keep their meaning.
    throw err;
  }

  // The template was delivered, so a fresh 24-hour window is now open.
  await stampWindow(input.phone, now);

  // Now upgrade: the rich message delivers inside the window we just opened.
  try {
    await input.sendRich();
    return { channel: "upgraded", delivered: true };
  } catch (err) {
    // The template landed, so the customer HAS been notified — the follow-up
    // is a bonus. Report honestly instead of failing the whole delivery.
    console.warn(
      `[window] rich upgrade failed for ${input.phone} (template did deliver):`,
      err instanceof Error ? err.message : err,
    );
    return { channel: "template-only", delivered: true };
  }
}
