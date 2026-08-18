/**
 * Delivery of the customer-facing confirmation created when a vendor logs a
 * credit. It is deliberately template-only: a ledger entry is a material
 * notification, so it must reach a customer even without an open 24-hour chat.
 */

import { formatNaira } from "@/lib/utils";
import { normaliseTemplateName } from "@/lib/otp-delivery";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/outbound";

export const DEFAULT_CREDIT_LOGGED_TEMPLATE = "vodium_credit_logged";

export function resolveCreditLoggedTemplateName(): string {
  const configured = process.env.WHATSAPP_CREDIT_LOGGED_TEMPLATE_NAME;
  return configured ? normaliseTemplateName(configured) ?? DEFAULT_CREDIT_LOGGED_TEMPLATE : DEFAULT_CREDIT_LOGGED_TEMPLATE;
}

export async function sendCreditLoggedNotification(input: {
  organizationId?: string | null;
  phone: string;
  customerName: string;
  shopName: string;
  amount: number;
  description?: string | null;
  loggedAt: Date;
  dueDate: Date;
}): Promise<{ delivered: boolean; reason?: string }> {
  // Placeholder numbers are used for ledger imports and cannot receive WhatsApp.
  if (!input.phone || input.phone.startsWith("pending:")) return { delivered: false, reason: "No customer WhatsApp number." };

  const creds = await getOrgChannelCredentials(input.organizationId);
  if (!creds) return { delivered: false, reason: "No WhatsApp channel credentials." };

  const template = resolveCreditLoggedTemplateName();
  const firstName = input.customerName.trim().split(/\s+/)[0] || input.customerName;
  const item = input.description?.trim() || "goods or services";
  const date = input.loggedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const due = input.dueDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  try {
    await sendWhatsAppTemplate(
      input.phone,
      template,
      [firstName, input.shopName, formatNaira(input.amount), item, date, due],
      { creds, languageCode: process.env.WHATSAPP_CREDIT_LOGGED_TEMPLATE_LANG ?? "en_US" },
    );
    return { delivered: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown template delivery error.";
    console.error(`[credit-notification] template "${template}" failed for ${input.phone}:`, reason);
    return { delivered: false, reason };
  }
}
