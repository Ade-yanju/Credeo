import { normaliseTemplateName } from "@/lib/otp-delivery";

export const DEFAULT_CREDIT_LOGGED_TEMPLATE = "vodium_credit_logged";

export function resolveCreditLoggedTemplateName(): string {
  const configured = process.env.WHATSAPP_CREDIT_LOGGED_TEMPLATE_NAME;
  return configured
    ? normaliseTemplateName(configured) ?? DEFAULT_CREDIT_LOGGED_TEMPLATE
    : DEFAULT_CREDIT_LOGGED_TEMPLATE;
}
