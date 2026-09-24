import { NextRequest, NextResponse } from "next/server";
import { dispatchDueWhatsAppOutbox } from "@/lib/whatsapp/outbox";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await dispatchDueWhatsAppOutbox(25);
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
