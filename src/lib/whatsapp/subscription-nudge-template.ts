import { normaliseTemplateName } from "@/lib/otp-delivery";

export const DEFAULT_SUBSCRIPTION_NUDGE_TEMPLATE = "vodium_subscription_nudge";

export function resolveSubscriptionNudgeTemplateName(): string {
  const configured = process.env.WHATSAPP_SUBSCRIPTION_NUDGE_TEMPLATE_NAME;
  if (!configured) return DEFAULT_SUBSCRIPTION_NUDGE_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_SUBSCRIPTION_NUDGE_TEMPLATE;
}
