import { normaliseTemplateName } from "@/lib/otp-delivery";

export const DEFAULT_VENDOR_DIGEST_TEMPLATE = "vodium_vendor_digest";

export function resolveVendorDigestTemplateName(): string {
  const configured = process.env.WHATSAPP_VENDOR_DIGEST_TEMPLATE_NAME;
  if (!configured) return DEFAULT_VENDOR_DIGEST_TEMPLATE;
  return normaliseTemplateName(configured) ?? DEFAULT_VENDOR_DIGEST_TEMPLATE;
}
