import type { DemoMessage } from "@/lib/whatsapp-demo-data";
import { cn } from "@/lib/utils";

/**
 * WhatsApp conversation mockup.
 *
 * Extracted from the /whatsapp page so the landing page's step sequence can
 * show the same thing without a second copy of the bubble markup. Colours are
 * WhatsApp's own dark palette rather than Vodium tokens — the point of this
 * mockup is that a vendor recognises the app they already use, so it should
 * look like WhatsApp, not like our dashboard.
 *
 * Renders as a single `role="img"` with one summary label. A screen reader
 * getting eight bubbles read out individually learns less than it does from
 * "vendor sends ADD, bot asks name, amount, due date, confirms saved".
 */

const WA = {
  shell: "#111B21",
  header: "#202C33",
  pane: "#0B141A",
  outgoing: "#005C4B",
  incoming: "#202C33",
} as const;

/**
 * WhatsApp renders *asterisk-wrapped* runs as bold, and the bot's real copy
 * uses that markup — printing it literally would leave stray asterisks in the
 * mockup.
 */
function formatBold(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <strong key={i} className="font-semibold">
        {part.slice(1, -1)}
      </strong>
    ) : (
      part
    ),
  );
}

export function WhatsAppChat({
  messages,
  label,
  minHeight = 380,
  className,
}: {
  messages: DemoMessage[];
  /** Screen-reader summary of the exchange. */
  label: string;
  /** Pane min-height in px. Lower it for short, single-message mockups. */
  minHeight?: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-3xl border border-[color:var(--hairline-strong)] shadow-2xl",
        className,
      )}
      style={{ background: WA.shell }}
    >
      {/* Contact header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: WA.header }}
      >
        {/* Avatar fill is WA.shell, not `--surface-1`. This mockup keeps
            WhatsApp's palette on purpose, so it must not read Vodium band
            tokens: on a light band `--surface-1` resolves to near-white and the
            avatar became a white blob with an unreadable gold V on it. */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-vodium-gold/40"
          style={{ background: WA.shell }}
        >
          <span className="font-serif text-base leading-none text-vodium-gold">
            V
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">
            VODIUM
          </p>
          <p className="text-[11px] text-white/40">WhatsApp Bot · online</p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="space-y-2 px-3 py-4"
        style={{ background: WA.pane, minHeight }}
      >
        {messages.map((msg, i) => {
          const isUser = msg.from === "user";
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  isUser
                    ? "rounded-tr-sm text-white"
                    : "rounded-tl-sm text-white/85"
                }`}
                style={{ background: isUser ? WA.outgoing : WA.incoming }}
              >
                {formatBold(msg.text)}
                {isUser && (
                  <span className="mt-1 block text-right text-[10px] text-white/40">
                    ✓✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
