import { prisma } from "@/lib/prisma";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import {
  sendWhatsAppDocumentTemplate,
  sendWhatsAppTemplate,
  WhatsAppSendError,
} from "@/lib/whatsapp/outbound";
import type { WhatsAppOutboxKind } from "@prisma/client";

type EnqueueInput = {
  idempotencyKey: string;
  organizationId?: string | null;
  recipient: string;
  kind: WhatsAppOutboxKind;
  templateName: string;
  languageCode?: string;
  bodyParams: string[];
  documentLink?: string;
  filename?: string;
};

export async function enqueueWhatsAppTemplate(input: EnqueueInput): Promise<{ id: string; duplicate: boolean }> {
  const existing = await prisma.whatsAppOutboxMessage.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  if (existing) return { id: existing.id, duplicate: true };

  try {
    const row = await prisma.whatsAppOutboxMessage.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        recipient: input.recipient,
        kind: input.kind,
        templateName: input.templateName,
        languageCode: input.languageCode ?? "en_US",
        bodyParams: input.bodyParams,
        documentLink: input.documentLink,
        filename: input.filename,
      },
      select: { id: true },
    });
    return { id: row.id, duplicate: false };
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      const row = await prisma.whatsAppOutboxMessage.findUniqueOrThrow({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true },
      });
      return { id: row.id, duplicate: true };
    }
    throw err;
  }
}

export async function dispatchWhatsAppOutboxMessage(
  id: string,
  options?: { rethrowFailure?: boolean },
): Promise<"SENT" | "RETRY" | "FAILED"> {
  const row = await prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  if (!row || row.status === "SENT") return "SENT";

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const claimed = await prisma.whatsAppOutboxMessage.updateMany({
    where: {
      id,
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", updatedAt: { lte: staleBefore } },
      ],
    },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    const current = await prisma.whatsAppOutboxMessage.findUnique({ where: { id }, select: { status: true } });
    return current?.status === "SENT" ? "SENT" : current?.status === "FAILED" ? "FAILED" : "RETRY";
  }

  try {
    const creds = row.organizationId ? await getOrgChannelCredentials(row.organizationId) : undefined;
    const bodyParams = Array.isArray(row.bodyParams)
      ? row.bodyParams.filter((value): value is string => typeof value === "string")
      : [];

    if (row.kind === "DOCUMENT_TEMPLATE") {
      if (!row.documentLink || !row.filename) throw new Error("Document template outbox row is missing its document.");
      await sendWhatsAppDocumentTemplate(row.recipient, row.templateName, row.documentLink, row.filename, bodyParams, {
        creds: creds ?? undefined,
        languageCode: row.languageCode,
      });
    } else {
      await sendWhatsAppTemplate(row.recipient, row.templateName, bodyParams, {
        creds: creds ?? undefined,
        languageCode: row.languageCode,
      });
    }

    await prisma.whatsAppOutboxMessage.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    });
    return "SENT";
  } catch (err) {
    const permanent = err instanceof WhatsAppSendError && err.permanent;
    const attempts = row.attempts + 1;
    const exhausted = attempts >= 5;
    const status = permanent || exhausted ? "FAILED" : "PENDING";
    await prisma.whatsAppOutboxMessage.update({
      where: { id },
      data: {
        status,
        lastError: err instanceof Error ? err.message.slice(0, 500) : "WhatsApp send failed",
        availableAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** Math.min(attempts, 8) * 60_000)),
      },
    });
    if (options?.rethrowFailure) throw err;
    return status === "FAILED" ? "FAILED" : "RETRY";
  }
}

export async function dispatchDueWhatsAppOutbox(limit = 50): Promise<{ sent: number; retry: number; failed: number }> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const rows = await prisma.whatsAppOutboxMessage.findMany({
    where: {
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", updatedAt: { lte: staleBefore } },
      ],
    },
    orderBy: { availableAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true },
  });
  const result = { sent: 0, retry: 0, failed: 0 };
  for (const row of rows) {
    const status = await dispatchWhatsAppOutboxMessage(row.id);
    if (status === "SENT") result.sent++;
    else if (status === "RETRY") result.retry++;
    else result.failed++;
  }
  return result;
}
