/**
 * Vodium Ledger — AI fallback for messages the deterministic bot didn't grasp.
 *
 * ORDERING RULE (inherited from nlu.ts): exact commands always win, then
 * phrases, then keywords, then typo tolerance. This module runs ONLY after all
 * of that has failed — i.e. only where the bot was about to reply "Sorry, I
 * didn't catch that". It can therefore never regress an existing behaviour: the
 * worst case is the same unknown reply the vendor would have received anyway.
 *
 * It exists because real vendor messages look like "chidi collect 2 bread 500"
 * or "abeg add 1500 for amara make she pay friday" — natural Nigerian English
 * and Pidgin that no alias table will ever fully cover.
 *
 * Everything here degrades to null without ANTHROPIC_API_KEY.
 */

import { parseAddCredit } from "@/lib/ai";
import { formatNaira } from "@/lib/utils";

export interface AiFallbackResult {
  /** Message to send instead of the "didn't catch that" copy. */
  reply: string;
  buttons?: Array<{ id: string; title: string }>;
  /** Prefilled ADD flow, staged for the vendor to confirm. */
  pendingCredit?: {
    customerName: string;
    amount: number;
    note?: string;
  };
}

/**
 * Try to rescue an unrecognised vendor message.
 * Returns null when AI is unavailable or the message still makes no sense —
 * the caller then sends its normal unknown reply.
 */
export async function rescueUnknownMessage(input: {
  message: string;
  /** Only vendors can add credit; customers get no rescue. */
  isVendor: boolean;
}): Promise<AiFallbackResult | null> {
  if (!input.isVendor) return null;

  const parsed = await parseAddCredit({ message: input.message });
  if (!parsed) return null;

  // Prefer an explicit total; otherwise derive it from the line items.
  const derived = parsed.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const amount = parsed.amountOwed > 0 ? parsed.amountOwed : derived;
  if (amount <= 0 || !parsed.customerName) return null;

  const itemSummary = parsed.items.length
    ? "\n" + parsed.items.map((i) => `• ${i.name} ×${i.quantity}`).join("\n")
    : "";

  // Confirm rather than act. The model is reading loose Pidgin, so a wrong
  // silent write to someone's ledger is the one outcome worth avoiding.
  return {
    reply:
      `Did you mean to record this credit?\n\n` +
      `*Customer:* ${parsed.customerName}\n` +
      `*Amount:* ${formatNaira(amount)}${itemSummary}\n\n` +
      `Tap *Yes* to continue, or reply *ADD* to enter it step by step.`,
    buttons: [
      { id: "AI_CONFIRM_ADD", title: "Yes, add it" },
      { id: "CANCEL", title: "No, cancel" },
    ],
    pendingCredit: { customerName: parsed.customerName, amount, note: parsed.note },
  };
}
