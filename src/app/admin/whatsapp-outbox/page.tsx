import { WhatsAppOutboxPanel } from "@/components/admin/whatsapp-outbox-panel";

export const dynamic = "force-dynamic";

export default function WhatsAppOutboxPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-vodium-gold">Operations</p>
        <h1 className="mt-1 font-serif text-2xl text-vodium-cream md:text-3xl">WhatsApp outbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-vodium-cream/45">
          Monitor queued template deliveries, investigate failures, and retry messages without touching the database.
        </p>
      </div>
      <WhatsAppOutboxPanel />
    </div>
  );
}
