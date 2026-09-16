import { prisma } from "@/lib/prisma";

/**
 * Persist an inbound Meta message before business logic runs.
 *
 * Returns false for a duplicate message id. The unique database constraint is
 * the durable guard; Redis in the webhook remains the lower-latency guard.
 */
export async function claimInboundEvent(input: {
  messageId?: string;
  phone: string;
  phoneNumberId?: string;
  messageType: string;
  body?: string;
}): Promise<boolean> {
  if (!input.messageId) return true;

  try {
    await prisma.whatsAppInboundEvent.create({
      data: {
        messageId: input.messageId,
        phone: input.phone,
        phoneNumberId: input.phoneNumberId,
        messageType: input.messageType,
        body: input.body?.slice(0, 4000),
      },
    });
    return true;
  } catch (err) {
    // Prisma's known-request error code is intentionally checked structurally
    // so this helper stays small and does not couple webhook control flow to a
    // generated Prisma error class.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}
