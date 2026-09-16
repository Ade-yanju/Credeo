import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasOrgAdminAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { ipFromRequest, writeAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto/secrets";

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

const schema = z.object({
  displayName: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().max(30).nullish(),
  phoneNumberId: z.string().max(120).nullish(),
  businessAccountId: z.string().max(120).nullish(),
  accessTokenRef: z.string().max(160).nullish(),
  accessToken: z.string().max(400).nullish(), // raw token — re-encrypted; null clears it
  status: z.enum(["TEST", "ACTIVE", "DISABLED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Re-encrypt the token when provided; an explicit empty/null value clears it.
  let encUpdate: { accessTokenEnc: string | null } | Record<string, never> = {};
  if (data.accessToken !== undefined) {
    if (data.accessToken) {
      const enc = encryptSecret(data.accessToken);
      if (!enc) {
        return NextResponse.json(
          { error: "Token encryption is not configured (set SECRET_ENCRYPTION_KEY)." },
          { status: 503 }
        );
      }
      encUpdate = { accessTokenEnc: enc };
    } else {
      encUpdate = { accessTokenEnc: null };
    }
  }

  // Redact the raw token from the audit trail.
  const auditChanges: Record<string, unknown> = { ...data };
  delete auditChanges.accessToken;

  try {
    const updated = await prisma.whatsAppChannel.update({
      where: { id: channel.id },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber?.trim() || null } : {}),
        ...(data.phoneNumberId !== undefined ? { phoneNumberId: data.phoneNumberId?.trim() || null } : {}),
        ...(data.businessAccountId !== undefined ? { businessAccountId: data.businessAccountId?.trim() || null } : {}),
        ...(data.accessTokenRef !== undefined ? { accessTokenRef: data.accessTokenRef?.trim() || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...encUpdate,
      },
      select: PUBLIC_CHANNEL_FIELDS,
    });

    await writeAudit({
      actorType: "vendor",
      actorId: ctx.vendor.id,
      action: "whatsapp.channel_updated",
      entityType: "WhatsAppChannel",
      entityId: channel.id,
      metadata: { organizationId: ctx.organizationId, changes: { ...auditChanges, accessTokenSet: data.accessToken !== undefined } },
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ ok: true, channel: updated });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message.includes("Unique")
      ? "This WhatsApp phone number ID is already connected."
      : "Could not update WhatsApp channel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
