import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/utils";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { resolveChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendWhatsAppMessage } from "@/lib/whatsapp/outbound";

const schema = z.object({ toPhone: z.string().min(7).max(20) });

// POST /api/whatsapp/channels/[id]/test — send a test message so the store can
// confirm their number is connected and working.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId! },
  });
  if (!channel) return NextResponse.json({ error: "WhatsApp channel not found." }, { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  const phone = normalisePhone(parsed.data.toPhone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const creds = resolveChannelCredentials(channel);
  if (!creds) {
    return NextResponse.json(
      { error: "No working credentials for this channel. Add an access token (or env reference) and a phone number ID." },
      { status: 400 }
    );
  }

  try {
    await sendWhatsAppMessage(
      phone,
      `✅ ${ctx.organization?.name ?? "Your store"} WhatsApp is connected on Vodium Ledger. This is a test message.`,
      creds
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed. Check the token and that the number is registered." },
      { status: 502 }
    );
  }
}
