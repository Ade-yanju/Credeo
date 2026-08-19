import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasTenantWriteAccess, requireTenantContext } from "@/lib/tenant-context";
import { entitlementDenied } from "@/lib/entitlement-guard";
import { signInvoiceToken } from "@/lib/bnpl-token";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";
import { sendCustomerInvoice } from "@/lib/whatsapp/invoice-delivery";
import { formatNaira } from "@/lib/utils";
import { ipFromRequest, writeAudit } from "@/lib/audit";

// POST /api/invoices/[id]/send — WhatsApp the customer a link to their invoice.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireTenantContext();
  if (!hasTenantWriteAccess(ctx) || !ctx.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Sending an invoice is outbound messaging on our WhatsApp number — a paid
  // action, and one that costs real money per send.
  const denied = entitlementDenied(ctx.vendor.subscription, "invoice.send");
  if (denied) return denied;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { student: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (["PAID", "CANCELLED"].includes(invoice.status)) {
    return NextResponse.json({ error: `This invoice is already ${invoice.status.toLowerCase()}.` }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const token = signInvoiceToken(invoice.id);
  const link = `${appUrl}/invoice/${token}`;
  const pdfLink = `${appUrl}/invoice/${token}/pdf`;
  const storeName = ctx.organization?.name ?? ctx.vendor.businessName;
  const due = invoice.dueDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  const body =
    `Hi *${invoice.student.fullName}* 👋\n\n` +
    `${storeName} has sent you an invoice.\n\n` +
    `*Invoice:* ${invoice.invoiceNumber}\n` +
    `*Amount:* ${formatNaira(Number(invoice.total))}\n` +
    `*Due:* ${due}\n\n` +
    `View it here:\n${link}\n\n` +
    `Thank you! 🙏`;

  const creds = await getOrgChannelCredentials(ctx.organizationId);

  try {
    const delivery = await sendCustomerInvoice({
      phone: invoice.student.phone,
      customerName: invoice.student.fullName,
      shopName: storeName,
      invoiceNumber: invoice.invoiceNumber,
      total: Number(invoice.total),
      dueDate: invoice.dueDate,
      link,
      pdfLink,
      richBody: body,
      creds: creds ?? undefined,
    });
    console.log(`[invoices/send] invoice=${invoice.invoiceNumber} to=${invoice.student.phone} channel=${delivery.channel} delivered=${delivery.delivered}`);
    if (!delivery.delivered) {
      console.warn(`[invoices/send] NOT guaranteed delivered — ${delivery.templateIssue ?? "no open session and no usable template"}`);
    }
  } catch (err) {
    console.error("[invoices/send] WhatsApp send failed:", err);
    return NextResponse.json(
      { error: "Could not deliver on WhatsApp. Share the link manually.", link },
      { status: 502 }
    );
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: new Date() },
  });

  await writeAudit({
    actorType: "vendor",
    actorId: ctx.vendor.id,
    action: "invoice.sent",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { organizationId: ctx.organizationId, invoiceNumber: invoice.invoiceNumber, to: invoice.student.phone },
    ipAddress: ipFromRequest(req),
  });

  return NextResponse.json({ ok: true, invoice: updated, link });
}
