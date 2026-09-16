/**
 * Convert a safe AI classification into input for the existing WhatsApp state
 * machine. This module is pure so the mapping is easy to regression-test.
 */

export type AiCommandIntent =
  | "ADD"
  | "LIST"
  | "PAID"
  | "SCORE"
  | "INVOICE"
  | "DASHBOARD"
  | "SUPPORT"
  | "HELP"
  | "BANK"
  | "FREE_TEXT";

export function commandTextForAi(input: {
  intent: AiCommandIntent;
  confidence: number;
  customerQuery?: string;
}, minimumConfidence = 0.8): string | null {
  if (input.confidence < minimumConfidence || input.intent === "FREE_TEXT") return null;

  const query = input.customerQuery?.trim().replace(/\s+/g, " ").slice(0, 80);
  switch (input.intent) {
    case "ADD": return "ADD";
    case "LIST": return "LIST";
    case "PAID": return query ? `PAID ${query}` : "PAID";
    case "SCORE": return query ? `SCORE ${query}` : "SCORE";
    case "INVOICE": return "INVOICE";
    case "DASHBOARD": return "DASHBOARD";
    case "SUPPORT": return "SUPPORT";
    case "HELP": return "HELP";
    case "BANK": return "BANK";
  }

  return null;
}
