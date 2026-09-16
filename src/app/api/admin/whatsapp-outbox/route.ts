import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/session";
import { dispatchWhatsAppOutboxMessage } from "@/lib/whatsapp/outbox";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CAN_MANAGE = ["SUPER_ADMIN", "CUSTOMER_CARE", "ANALYTICS"];

export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_MANAGE.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [pending, processing, sent, failed, recent] = await Promise.all([
    prisma.whatsAppOutboxMessage.count({ where: { status: "PENDING" } }),
    prisma.whatsAppOutboxMessage.count({ where: { status: "PROCESSING" } }),
    prisma.whatsAppOutboxMessage.count({ where: { status: "SENT" } }),
    prisma.whatsAppOutboxMessage.count({ where: { status: "FAILED" } }),
    prisma.whatsAppOutboxMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        recipient: true,
        kind: true,
        templateName: true,
        status: true,
        attempts: true,
        lastError: true,
        availableAt: true,
        createdAt: true,
        sentAt: true,
      },
    }),
  ]);

  return NextResponse.json({ counts: { pending, processing, sent, failed }, recent });
}

const retrySchema = z.object({ id: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!CAN_MANAGE.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = retrySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid outbox id is required" }, { status: 400 });

  await prisma.whatsAppOutboxMessage.updateMany({
    where: { id: parsed.data.id, status: "FAILED" },
    data: { status: "PENDING", availableAt: new Date(), lastError: null },
  });
  const result = await dispatchWhatsAppOutboxMessage(parsed.data.id);
  return NextResponse.json({ ok: result === "SENT", status: result });
}
