import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/utils";
import { verifyOrderToken } from "@/lib/bnpl-token";
import { BnplConsentClient } from "@/components/ui/bnpl-consent-client";

export const dynamic = "force-dynamic";

export default async function BnplPublicPage({ params }: { params: { token: string } }) {
  const orderId = verifyOrderToken(params.token);
  if (!orderId) notFound();

  const order = await prisma.bnplOrder.findUnique({
    where: { id: orderId },
    include: {
      student: { select: { fullName: true } },
      branch: { select: { name: true } },
      organization: { select: { name: true, brandColor: true } },
      items: true,
      schedules: { orderBy: { dueAt: "asc" } },
      credit: { select: { amount: true, amountRepaid: true } },
    },
  });
  if (!order) notFound();

  const accepted = Boolean(order.termsAcceptedAt);
  const outstanding = order.credit
    ? Math.max(0, Number(order.credit.amount) - Number(order.credit.amountRepaid))
    : 0;
  const repaid = order.credit ? Number(order.credit.amountRepaid) : Number(order.totalAmount);
  const brand = order.organization?.brandColor || "#C9A961";

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-10 px-5">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="font-serif text-[11px] tracking-[0.28em]" style={{ color: brand }}>
            {order.organization?.name?.toUpperCase() ?? "VODIUM LEDGER"}
          </p>
          <h1 className="font-serif text-2xl text-vodium-cream mt-2 inline-flex items-center gap-2">
            <ReceiptText size={20} style={{ color: brand }} />
            {accepted ? "Your receipt" : "Confirm your order"}
          </h1>
          <p className="text-sm text-vodium-cream/45 mt-1">
            {order.branch?.name ? `${order.branch.name} · ` : ""}Order {order.orderNumber}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-vodium-charcoal overflow-hidden">
          {/* Items */}
          <div className="p-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-vodium-cream/35">Items</p>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-vodium-cream/80">
                <span>{item.quantity}× {item.name}</span>
                <span>{formatNaira(Number(item.totalPrice))}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-white/[0.06] p-5 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatNaira(Number(order.subtotal))} />
            {Number(order.discountAmount) > 0 && (
              <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`- ${formatNaira(Number(order.discountAmount))}`} />
            )}
            <Row label="Total" value={formatNaira(Number(order.totalAmount))} strong />
            {Number(order.downPayment) > 0 && <Row label="Paid upfront" value={formatNaira(Number(order.downPayment))} />}
            <Row label="Paid so far" value={formatNaira(repaid)} />
            <Row label="Outstanding" value={formatNaira(outstanding)} accent={brand} strong />
          </div>

          {/* Schedule */}
          {order.schedules.length > 0 && (
            <div className="border-t border-white/[0.06] p-5">
              <p className="text-xs uppercase tracking-wider text-vodium-cream/35 mb-2">Repayment schedule</p>
              <div className="space-y-1.5">
                {order.schedules.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm text-vodium-cream/70">
                    <span>{new Date(s.dueAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="flex items-center gap-2">
                      {formatNaira(Math.max(0, Number(s.amount) - Number(s.amountPaid)))}
                      <span className={s.status === "PAID" ? "text-emerald-300 text-xs" : "text-vodium-cream/40 text-xs"}>{s.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consent / status */}
          <div className="border-t border-white/[0.06] p-5">
            {accepted ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 size={16} />
                Terms accepted on {new Date(order.termsAcceptedAt!).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            ) : (
              <BnplConsentClient
                token={params.token}
                storeName={order.organization?.name ?? "the store"}
                customerName={order.student.fullName}
                total={formatNaira(Number(order.totalAmount))}
                dueDate={new Date(order.dueDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                brand={brand}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-vodium-cream/30 mt-5">
          Powered by Vodium Ledger · <Link href="/legal/bnpl-terms" className="underline hover:text-vodium-gold">BNPL terms</Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-vodium-cream/45">{label}</span>
      <span className={strong ? "font-semibold" : "text-vodium-cream/80"} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
