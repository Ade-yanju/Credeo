/**
 * Demo WhatsApp conversations used in marketing mockups.
 *
 * These are illustrations, not live bot output — but the wording is lifted from
 * the real bot so the marketing promise matches what a vendor actually sees.
 * `REMINDER_CONVERSATION` in particular mirrors `messages.reminderToCustomer()`
 * in src/lib/whatsapp/messages.ts; if that copy changes, change it here too.
 *
 * Shared by the /whatsapp page and the landing page's step sequence so the two
 * can't drift apart.
 */

export interface DemoMessage {
  from: "user" | "bot";
  text: string;
}

/** Vendor logs a credit: the full ADD flow, start to confirmation. */
export const ADD_CONVERSATION: DemoMessage[] = [
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

/**
 * What the *customer* receives before the due date — the vendor never sends it.
 * Condensed from `reminderToCustomer()`: the payout-details block and the
 * score-building line are dropped so the bubble stays readable at mockup size.
 */
export const REMINDER_CONVERSATION: DemoMessage[] = [
  {
    from: "bot",
    text:
      "Hi *Tunde* 👋\n\n" +
      "Friendly reminder from *Mama Taiwo Stores*: you have *₦3,500* due tomorrow.\n\n" +
      "Reply *PAID* once you've settled.",
  },
  { from: "user", text: "PAID" },
  {
    from: "bot",
    text: "✅ Thank you! I've let Mama Taiwo Stores know. Your Vodium score just went up.",
  },
];
