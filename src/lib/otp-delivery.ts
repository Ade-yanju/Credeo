/**
 * Vodium Ledger — customer OTP delivery via the Vodium Ledger WhatsApp bot.
 *
 * DESIGN: OTP is always sent from the PLATFORM's own WhatsApp number, never the
 * store's. Vendors need zero Meta setup for storefront OTP to work.
 *
 * Delivery order:
 *   1. If a 24-hour session is already open, plain WhatsApp text — fastest path,
 *      no template round-trip, and Meta guarantees delivery inside the window.
 *   2. WhatsApp OTP *template* from Vodium's number — the ONLY path that reaches
 *      a number with no open session (i.e. any first-time customer), because
 *      Meta silently drops business-initiated free text outside the window.
 *      Configure WHATSAPP_OTP_TEMPLATE_NAME once, or let the admin console
 *      create it in one click.
 *   3. Free text as a last resort. Reported as delivered:false because with no
 *      open session Meta accepts it and then drops it — callers must not claim
 *      "code sent" on the strength of this.
 *   4. Dev fallback: log to server console.
 */

import { sendWhatsAppMessage, sendWhatsAppTemplate, WhatsAppSendError } from "@/lib/whatsapp/outbound";

/**
 * Meta template names are lowercase identifiers: letters, digits, underscores.
 * A display name like "Vodium Ledger" can never be one, and attempting it costs
 * a failed API round-trip per configured language on every single OTP.
 */
export function isValidTemplateName(name: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(name);
}

/**
 * Coerce a loosely-written name into Meta's format: lowercase, spaces and
 * hyphens to underscores, anything else dropped.
 *
 * This exists because the configured value was "Vodium Ledger". If the account's
 * template is actually called `vodium_ledger`, that is one normalisation away
 * from working — so it is worth one attempt before giving up. Returns null when
 * nothing usable survives.
 */
export function normaliseTemplateName(name: string): string | null {
  const coerced = name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return isValidTemplateName(coerced) ? coerced : null;
}

/**
 * The template the admin console creates when none is configured. Because
 * resolution falls back to this name, "create the template" in the admin is
 * ALL the setup OTP needs — no env change, no redeploy.
 */
export const DEFAULT_OTP_TEMPLATE_NAME = "vodium_otp";

let provisionAttempted = false;

/**
 * The template name OTP sends will use: the env override when it's usable
 * (coerced into Meta's format if written loosely, e.g. "Vodium Ledger" →
 * "vodium_ledger"), else the platform default.
 */
export function resolveConfiguredTemplateName(): string {
  const configured = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  if (!configured) return DEFAULT_OTP_TEMPLATE_NAME;
  if (isValidTemplateName(configured)) return configured;
  const coerced = normaliseTemplateName(configured);
  if (!coerced) {
    console.warn(
      `[otp] WHATSAPP_OTP_TEMPLATE_NAME is "${configured}", which cannot be a Meta template name — ` +
      `using the platform default "${DEFAULT_OTP_TEMPLATE_NAME}" instead.`,
    );
    return DEFAULT_OTP_TEMPLATE_NAME;
  }
  return coerced;
}

export type OtpChannel = "whatsapp" | "console";

export async function sendOtpCode(input: {
  phone: string;
  code: string;
  storeName: string;
}): Promise<{ channel: OtpChannel; delivered: boolean }> {
  const { phone, code, storeName } = input;
  const hasVodiumWa = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (hasVodiumWa) {
    const freeText =
      `${code} is your verification code for your ${storeName} order on Vodium Ledger. ` +
      `It expires in 10 minutes. Do not share it.`;

    // An OTP is worthless late, so if a 24-hour window is already open we send
    // the code as free text immediately and skip the template round-trip
    // entirely. Out of session, only the approved AUTHENTICATION template will
    // actually be delivered by Meta.
    const { hasOpenSession } = await import("@/lib/whatsapp/session-window");
    if (await hasOpenSession(phone)) {
      try {
        await sendWhatsAppMessage(phone, freeText);
        return { channel: "whatsapp", delivered: true };
      } catch (err) {
        console.warn("[otp] in-session free-text failed, trying template:", err);
      }
    }

    // 1) Approved OTP template (the only path that reaches a number with no
    // open 24-hour session — i.e. any first-time customer). Falls back to the
    // platform default name, which the admin console can create in one click.
    const templateName = resolveConfiguredTemplateName();

    {
      const langs = [process.env.WHATSAPP_OTP_TEMPLATE_LANG, "en_US", "en"]
        .filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);
      const otpButton = process.env.WHATSAPP_OTP_TEMPLATE_BUTTON !== "false";
      for (const languageCode of langs) {
        try {
          await sendWhatsAppTemplate(phone, templateName, [code], { languageCode, otpButton });
          return { channel: "whatsapp", delivered: true };
        } catch (err) {
          console.warn(`[otp] template '${templateName}' (${languageCode}) failed:`, err instanceof Error ? err.message : err);
          // 132001 means the template NAME is unknown to Meta. Trying another
          // language cannot help, so stop rather than repeating the round-trip.
          if (err instanceof WhatsAppSendError && err.code === 132001) {
            console.error(
              `[otp] template "${templateName}" does not exist in this WhatsApp account. ` +
              `Create it from Admin → WhatsApp bot → "Create OTP template" (one click), ` +
              `or set WHATSAPP_OTP_TEMPLATE_NAME to an existing template's exact name.`,
            );
            if (!provisionAttempted) {
              provisionAttempted = true;
              try {
                const { ensureOtpTemplate } = await import("@/lib/whatsapp/otp-template");
                const result = await ensureOtpTemplate();
                if (result.created) {
                  console.log(`[otp] auto-created template "${result.resolvedName}" — used once Meta approves`);
                } else if (result.active?.status) {
                  console.log(`[otp] template "${result.resolvedName}" exists with status ${result.active.status}`);
                } else if (result.detail) {
                  console.warn(`[otp] auto-create failed: ${result.detail}`);
                }
              } catch (provisionErr) {
                console.warn("[otp] auto-create threw:", provisionErr);
              }
            }
            break;
          }
        }
      }
    }

    // 2) Last resort: free text with no open session. Meta accepts this and
    // then silently drops it, so we report delivered=false — callers must not
    // tell the customer "code sent" on the strength of this.
    try {
      await sendWhatsAppMessage(phone, freeText);
      console.warn(
        `[otp] sent free-text OTP to ${phone} with no open session and no usable template — ` +
        `Meta will most likely DROP this silently. Approve the OTP template to fix delivery.`,
      );
      return { channel: "whatsapp", delivered: false };
    } catch (err) {
      console.warn("[otp] WhatsApp free-text failed:", err);
    }
  }

  // 3) Fallback: only print the code outside production (or when debug is on).
  if (process.env.NODE_ENV !== "production" || process.env.OTP_DEBUG_RETURN === "true") {
    console.log(`\n[OTP → ${phone}] ${code} (${storeName})\n`);
  } else {
    console.warn(`[otp] No WhatsApp delivery configured for ${storeName}; code not sent.`);
  }
  return { channel: "console", delivered: false };
}
