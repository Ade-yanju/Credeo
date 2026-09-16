import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import { subscribeAppToWaba } from "@/lib/whatsapp/provisioning";

// Never expose token material (ciphertext or env ref values) to clients.
const PUBLIC_CHANNEL_FIELDS = {
  id: true,
  displayName: true,
  phoneNumber: true,
  phoneNumberId: true,
  businessAccountId: true,
  accessTokenRef: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const channelSchema = z.object({
  displayName: z.string().min(2).max(120),
  phoneNumber: z.string().max(30).optional(),
  phoneNumberId: z.string().max(120).optional(),
  businessAccountId: z.string().max(120).optional(),
  accessTokenRef: z.string().max(160).optional(),
  accessToken: z.string().max(400).optional(), // raw token — stored encrypted, never persisted plainly
  status: z.enum(["TEST", "ACTIVE", "DISABLED"]).default("TEST"),
});

export async function GET() {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return NextResponse.json({ channels: [] });

  const channels = await prisma.whatsAppChannel.findMany({
    where: { organizationId: ctx.organizationId },
    select: PUBLIC_CHANNEL_FIELDS,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ channels });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenantContext();
  const denied = entitlementDenied(ctx.vendor.subscription, "tenant.write");
  if (denied) return denied;
  if (!hasOrgAdminAccess(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = channelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const accessTokenEnc = parsed.data.accessToken ? encryptSecret(parsed.data.accessToken) : null;
  if (parsed.data.accessToken && !accessTokenEnc) {
    return NextResponse.json(
      { error: "Token encryption is not configured (set SECRET_ENCRYPTION_KEY). Use a token reference instead." },
      { status: 503 }
    );
  }

  try {
    const channel = await prisma.whatsAppChannel.create({
      data: {
        organizationId: ctx.organizationId!,
        displayName: parsed.data.displayName,
        phoneNumber: parsed.data.phoneNumber ?? null,
        phoneNumberId: parsed.data.phoneNumberId ?? null,
        businessAccountId: parsed.data.businessAccountId ?? null,
        accessTokenRef: parsed.data.accessTokenRef ?? null,
        accessTokenEnc,
        status: parsed.data.status,
      },
      select: PUBLIC_CHANNEL_FIELDS,
    });

    // Auto-subscribe our app to the store's WhatsApp Business Account so inbound
    // messages reach the webhook without manual webhook configuration.
    const subscribeToken = parsed.data.accessToken
      ?? (parsed.data.accessTokenRef ? process.env[parsed.data.accessTokenRef] : undefined);
    let webhookConnected = false;
    if (subscribeToken && parsed.data.businessAccountId) {
      const result = await subscribeAppToWaba(parsed.data.businessAccountId, subscribeToken);
      webhookConnected = result.ok;
      if (!result.ok) console.warn("[whatsapp/channels] subscribe failed:", result.error);
    }

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "whatsapp.channel_added",
      entityType: "WhatsAppChannel",
      entityId: channel.id,
      metadata: {
        organizationId: ctx.organizationId,
        displayName: channel.displayName,
        status: channel.status,
        phoneNumberId: channel.phoneNumberId,
      },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, channel, webhookConnected }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message.includes("Unique")
      ? "This WhatsApp phone number ID is already connected."
      : "Could not create WhatsApp channel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
