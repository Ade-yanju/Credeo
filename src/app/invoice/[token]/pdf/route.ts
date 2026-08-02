import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInvoiceToken } from "@/lib/bnpl-token";
import { generateInvoicePdf, invoicePdfFilename } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const invoiceId = verifyInvoiceToken(params.token);
  if (!invoiceId) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      student: true,
      vendor: true,
      branch: true,
      organization: {
        include: {
          branches: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1 },
        },
      },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const primaryBranch = invoice.branch ?? invoice.organization.branches[0] ?? null;
  const pdf = generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discountAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    notes: invoice.notes,
    store: {
      name: invoice.organization.name || invoice.vendor.businessName,
      ownerName: invoice.vendor.ownerName,
      phone: invoice.vendor.phone,
      email: invoice.vendor.email,
      address: branchAddress(primaryBranch) ?? invoice.vendor.location,
      branchName: invoice.branch?.name,
      bankName: invoice.vendor.bankName,
      bankAccountNumber: invoice.vendor.bankAccountNumber,
      bankAccountName: invoice.vendor.bankAccountName,
    },
    customer: {
      name: invoice.student.fullName,
      phone: invoice.student.phone,
      customerId: invoice.student.matricNumber,
    },
    items: invoice.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoicePdfFilename(invoice.invoiceNumber)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "public, max-age=300",
    },
  });
}

function branchAddress(
  branch: { address: string | null; city: string | null; state: string | null } | null | undefined
): string | null {
  if (!branch) return null;
  return [branch.address, branch.city, branch.state].filter(Boolean).join(", ") || null;
}
