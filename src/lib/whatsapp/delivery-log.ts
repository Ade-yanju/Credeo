import { prisma } from "@/lib/prisma";
import type { WhatsAppDeliveryKind } from "@prisma/client";

/** Best-effort delivery audit; a logging failure must never hide a sent message. */
export function logWhatsAppDelivery(input: {
  recipient: string;
  phoneNumberId?: string;
  kind: WhatsAppDeliveryKind;
  providerMessageId?: string;
}): void {
  void prisma.whatsAppDelivery.create({
    data: {
      recipient: input.recipient,
      phoneNumberId: input.phoneNumberId,
      kind: input.kind,
      providerMessageId: input.providerMessageId,
    },
  }).catch((err) => {
    console.error("[whatsapp] delivery log failed:", err instanceof Error ? err.message : err);
  });
}

export function reconcileWhatsAppDelivery(input: {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
}): void {
  const statusMap = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  } as const;
  const mapped = statusMap[input.status as keyof typeof statusMap];
  if (!mapped) return;

  void prisma.whatsAppDelivery.updateMany({
    where: { providerMessageId: input.providerMessageId },
    data: { status: mapped },
  }).catch((err) => {
    console.error("[whatsapp] delivery status reconciliation failed:", err instanceof Error ? err.message : err);
  });
}
