import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WhatsAppChat } from "@/components/ui/whatsapp-chat";
import { ADD_CONVERSATION } from "@/lib/whatsapp-demo-data";
import {
  MessageCircle,
  List,
  CheckCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

export const metadata = {
  title: "WhatsApp Bot : Vodium Ledger",
  description: "Track credits and send reminders right from WhatsApp.",
};

const chatMessages = ADD_CONVERSATION;

const commands = [
  {
    keyword: "ADD",
    icon: MessageCircle,
    label: "Log a credit",
    description:
      "Record a new credit for any customer in seconds. Vodium captures the name, amount, and due date.",
  },
  {
    keyword: "LIST",
    icon: List,
    label: "View who owes",
    description:
      "Get a live summary of all outstanding credits : sorted by due date so you know who to chase first.",
  },
  {
    keyword: "PAID [name]",
    icon: CheckCircle,
    label: "Mark as paid",
    description:
      "When a customer settles up, mark them paid instantly. Their Vodium Score updates automatically.",
  },
  {
    keyword: "HELP",
    icon: HelpCircle,
    label: "See all commands",
    description:
      "Forgotten a command? Message HELP and Vodium will send you the full command list.",
  },
];

export default function WhatsAppPage() {
  return (
    <div className="marketing-page min-h-screen">
      <SiteNav />

      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-28 pb-16">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 eyebrow mb-6">
                <MessageCircle size={13} />
                WhatsApp Bot
              </span>
              <h1 className="font-serif text-[38px] leading-[1.08] tracking-[-0.02em] text-[color:var(--text-primary)] md:text-[52px] mb-6">
                Your credit ledger{" "}
                <span className="">lives in WhatsApp.</span>
              </h1>
              <p className="text-[color:var(--text-tertiary)] text-xl leading-relaxed max-w-2xl mb-10">
                No app to download. No browser to open. Just message VODIUM on
                WhatsApp and you&apos;re tracking.
              </p>
              <a
                href="https://wa.me/2347019575717?text=HELP"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 btn-gold px-6 py-3 rounded-xl text-sm font-semibold"
              >
                <MessageCircle size={15} />
                Start on WhatsApp
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <div className="brand-divider" />
        </section>

        {/* Chat mockup */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-start">
            {/* Left copy */}
            <div>
              <span className="eyebrow block mb-5">
                See it in action
              </span>
              <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px] mb-6 leading-snug">
                Add a credit in under 15 seconds.
              </h2>
              <p className="text-[color:var(--text-tertiary)] text-base leading-relaxed mb-5">
                Vodium&apos;s bot guides you through every step. No forms, no
                typing long commands just a natural conversation.
              </p>
              <p className="text-[color:var(--text-tertiary)] text-base leading-relaxed">
                Once saved, Vodium automatically messages the customer a reminder
                before the due date or time so you don&apos;t have to.
              </p>
            </div>

            {/* WhatsApp chat mockup */}
            <div className="mx-auto w-full max-w-sm">
              <WhatsAppChat
                messages={chatMessages}
                label="WhatsApp conversation: the vendor sends ADD, the bot asks for the customer's name, amount and due date, then confirms the credit was saved."
              />
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="border-t border-[color:var(--hairline)] bg-[color:var(--surface-1)]">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
            <div className="mb-12 text-center">
              <span className="eyebrow block mb-4">
                Commands
              </span>
              <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px]">
                Simple commands. Powerful results.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {commands.map(({ keyword, icon: Icon, label, description }) => (
                <div
                  key={keyword}
                  className="card-dark-hover p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-vodium-gold/10 border border-vodium-gold/20 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-vodium-gold" />
                    </div>
                    <code
                      className="text-sm font-bold text-vodium-gold tracking-wider px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(201,169,97,0.1)" }}
                    >
                      {keyword}
                    </code>
                  </div>
                  <div>
                    <p className="text-[color:var(--text-primary)] font-semibold text-sm mb-1.5">
                      {label}
                    </p>
                    <p className="text-[color:var(--text-tertiary)] text-xs leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center">
          <span className="inline-block eyebrow mb-5">
            Ready?
          </span>
          <h2 className="font-serif text-[32px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)] md:text-[40px] mb-5 leading-snug">
            Start tracking now.
          </h2>
          <p className="text-[color:var(--text-tertiary)] text-base mb-10 max-w-sm mx-auto">
            Message HELP to get started. No signup required just WhatsApp.
          </p>
          <a
            href="https://wa.me/2347019575717?text=HELP"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 btn-gold px-7 py-3.5 rounded-xl text-sm font-semibold"
          >
            <MessageCircle size={16} />
            Open WhatsApp
            <ExternalLink size={13} />
          </a>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
