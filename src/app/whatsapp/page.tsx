import Link from "next/link";
import {
  ArrowLeft,
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

const chatMessages = [
  { from: "user", text: "ADD" },
  {
    from: "bot",
    text: "📋 Add new credit\n\nWhat's the customer's name?",
  },
  { from: "user", text: "Tunde Fashola" },
  { from: "bot", text: "Amount? (e.g. 2500)" },
  { from: "user", text: "3500" },
  { from: "bot", text: "Due date? (e.g. 15/07)" },
  { from: "user", text: "20/07" },
  {
    from: "bot",
    text: "✅ Credit saved!\nTunde Fashola owes ₦3,500 due 20 Jul. I'll remind them before the due date.",
  },
];

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
    <div className="min-h-screen bg-vodium-black text-vodium-cream">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.06] pt-safe px-safe">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-lg leading-none">
                V
              </span>
            </div>
            <span className="font-serif tracking-[0.18em] text-vodium-gold text-sm">
              VODIUM LEDGER
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-vodium-cream/50 hover:text-vodium-gold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Home
            </Link>
            <Link
              href="/register"
              className="btn-gold px-4 py-2 rounded-lg text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero */}
        <section className="mesh-bg relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-28 pb-16">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold mb-6">
                <MessageCircle size={13} />
                WhatsApp Bot
              </span>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-vodium-cream leading-[1.05] mb-6">
                Your credit ledger{" "}
                <span className="text-gradient-gold">lives in WhatsApp.</span>
              </h1>
              <p className="text-vodium-cream/55 text-xl leading-relaxed max-w-2xl mb-10">
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
              <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-5">
                See it in action
              </span>
              <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream mb-6 leading-snug">
                Add a credit in under 15 seconds.
              </h2>
              <p className="text-vodium-cream/55 text-base leading-relaxed mb-5">
                Vodium&apos;s bot guides you through every step. No forms, no
                typing long commands just a natural conversation.
              </p>
              <p className="text-vodium-cream/55 text-base leading-relaxed">
                Once saved, Vodium automatically messages the customer a reminder
                before the due date or time so you don&apos;t have to.
              </p>
            </div>

            {/* WhatsApp chat mockup */}
            <div className="mx-auto w-full max-w-sm">
              {/* Phone shell */}
              <div
                className="rounded-3xl overflow-hidden border border-white/[0.10] shadow-2xl"
                style={{ background: "#111B21" }}
              >
                {/* WA header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ background: "#202C33" }}
                >
                  <div className="w-9 h-9 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center flex-shrink-0">
                    <span className="font-serif text-vodium-gold text-base leading-none">
                      V
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">
                      VODIUM
                    </p>
                    <p className="text-white/40 text-[11px]">
                      WhatsApp Bot · online
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="px-3 py-4 space-y-2 min-h-[380px]"
                  style={{ background: "#0B141A" }}
                >
                  {chatMessages.map((msg, i) => {
                    const isUser = msg.from === "user";
                    return (
                      <div
                        key={i}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${
                            isUser
                              ? "rounded-tr-sm text-white"
                              : "rounded-tl-sm text-white/85"
                          }`}
                          style={{
                            background: isUser ? "#005C4B" : "#202C33",
                          }}
                        >
                          {msg.text}
                          <span
                            className={`block text-[10px] mt-1 ${isUser ? "text-right text-white/40" : "text-white/30"}`}
                          >
                            {isUser ? "✓✓" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="border-t border-white/[0.06] bg-vodium-charcoal/30">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
            <div className="mb-12 text-center">
              <span className="text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold block mb-4">
                Commands
              </span>
              <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream">
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
                    <p className="text-vodium-cream font-semibold text-sm mb-1.5">
                      {label}
                    </p>
                    <p className="text-vodium-cream/45 text-xs leading-relaxed">
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
          <span className="inline-block text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold mb-5">
            Ready?
          </span>
          <h2 className="font-serif text-3xl md:text-4xl text-vodium-cream mb-5 leading-snug">
            Start tracking now.
          </h2>
          <p className="text-vodium-cream/50 text-base mb-10 max-w-sm mx-auto">
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
      <footer className="border-t border-white/[0.06] py-10 px-6 md:px-12 mt-24">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-vodium-cream/30">
          <span className="text-center md:text-left">© 2026 Vodium. Lagos, Nigeria.<br />Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921).</span>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="hover:text-vodium-gold transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-vodium-gold transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/about"
              className="hover:text-vodium-gold transition-colors"
            >
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
