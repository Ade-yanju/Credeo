/**
 * Vodium Ledger — WhatsApp message templates.
 * Keep copy short, Nigerian-English, respectful, no slang that excludes older vendors.
 */

import { formatNaira } from "../utils";

export type CreditEntry = {
  customerName: string;
  amount: number;
  daysUntilDue: number; // negative = overdue
};

export type InvoiceItemEntry = {
  name: string;
  quantity: number;
  unitPrice: number;
};

function invoiceItemLines(items: InvoiceItemEntry[]): string {
  return items
    .map((i, idx) => `${idx + 1}. *${i.name}* ×${i.quantity} : ${formatNaira(i.quantity * i.unitPrice)}`)
    .join("\n");
}


/**
 * The "how do I pay you" block appended to customer reminders. Returns an empty
 * string when the vendor hasn't set details, so copy stays clean either way.
 */
export function payToBlock(bank?: {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
}): string {
  if (!bank?.bankName || !bank?.bankAccountNumber) return "";
  const name = bank.bankAccountName ? `\n${bank.bankAccountName}` : "";
  return `\n\n🏦 *Pay to:*\n${bank.bankName} — ${bank.bankAccountNumber}${name}`;
}

export const messages = {
  // ── Welcome & onboarding ───────────────────────────────────────────────
  welcome: () =>
    `👋 Welcome to *Vodium Ledger*.\n\n` +
    `I help vendors track who owes them money and recover it faster.\n\n` +
    `Reply:\n` +
    `• *START* : set up your shop\n` +
    `• *HELP* : see all commands`,

  alreadyRegistered: (businessName: string) =>
    `Welcome back! 👋 *${businessName}* is already set up.\n\n` +
    `Reply *HELP* to see what I can do.`,

  onboardingAskName: () => `Let's get your shop set up. What's your full name?`,

  onboardingAskBusiness: (name: string) =>
    `Nice to meet you, *${name}*. What's the name of your shop or business?`,

  onboardingAskUniversity: () =>
    `Which city or community is your shop in?\n\n` +
    `Reply with the short code if it's a known hub (e.g. *UNILAG*, *OAU*) or the community name (e.g. *Lagos*, *Ibadan*).`,

  onboardingDone: (businessName: string) =>
    `✅ *${businessName}* is set up on Vodium Ledger!\n\n` +
    `You have a 60-day free trial. Let's record your first credit.\n\n` +
    `Reply *ADD* to add a credit, or *HELP* for all commands.`,

  // ── ADD credit flow ────────────────────────────────────────────────────
  addCreditAskCustomer: () =>
    `Who took the credit? Send their full name.\n\n` +
    `Example: *Chidi Okeke*\n\n` +
    `_Tip: next time send it all at once —_\n` +
    `_*ADD Chidi Okeke 08012345678 2500 7d*_`,

  addCreditNameLooksWrong: () =>
    `That looks like more than a name. 🤔 Send just the customer's *name* first.\n\n` +
    `Example: *Chidi Okeke*\n\n` +
    `_Or send everything in one line:_\n` +
    `_*ADD Chidi Okeke 08012345678 2500 7d*_`,

  addCreditAskPhone: (customerName: string) =>
    `What is *${customerName}'s* WhatsApp number?\n\n` +
    `Type it, or tap 📎 and *share their contact* — no typing needed.\n\n` +
    `Example: *08012345678*`,

  addCreditAskAmount: (customerName: string) =>
    `How much does *${customerName}* owe? Send just the number.\n\n` +
    `Example: *2500*`,

  addCreditAskAmountWithScore: (customerName: string, warning: string) =>
    `${warning}\n\n` +
    `How much does *${customerName}* owe? Send just the number.\n\n` +
    `Example: *2500*`,

  addCreditAskDue: (customerName: string, amount: number) =>
    `${formatNaira(amount)} for *${customerName}*. ✓\n\n` +
    `When should they pay back? Reply with:\n` +
    `• *30M* : in 30 minutes\n` +
    `• *2H* : in 2 hours\n` +
    `• *7* : in 7 days\n` +
    `• *END* : end of month\n` +
    `• *15-06-2026* : a specific date`,

  /**
   * Shown immediately before a credit is saved. Echoes the parsed details —
   * crucially the PHONE NUMBER — so a mistyped digit is caught here rather than
   * silently logging the debt against a stranger who then gets the reminders.
   */
  addCreditConfirmBeforeSave: (
    customerName: string,
    phone: string,
    amount: number,
    dueText: string,
  ) =>
    `Check this before I save it 👇\n\n` +
    `👤 *${customerName}*\n` +
    `📱 ${phone}\n` +
    `💰 *${formatNaira(amount)}*\n` +
    `📅 Due ${dueText}\n\n` +
    `Tap *Save* to record it — I'll remind them politely before it's due.\n` +
    `Wrong number? Tap *Cancel* and start again.`,

  addCreditAskReminders: (customerName: string) =>
    `Last thing — should I send *${customerName}* polite reminders about this credit?\n\n` +
    `• *Yes* : I'll remind them respectfully before it's due\n` +
    `• *No* : I stay silent and you follow up yourself`,

  noReminderPromise: () =>
    `I won't message them about this one — you'll follow up yourself. It still counts in *LIST* and their Vodium score.`,

  addCreditConfirmed: (
    customerName: string,
    amount: number,
    dueDateText: string,
    reminderText: string,
  ) =>
    `✅ Saved.\n\n` +
    `*${customerName}* owes you *${formatNaira(amount)}*, due ${dueDateText}.\n\n` +
    `${reminderText}\n\n` +
    `Reply *ADD* for another, or *LIST* to see everyone who owes you.`,

  invalidAmount: () =>
    `That doesn't look like a valid amount. Please send just the number.\n\nExample: *2500*`,

  invalidDueDate: () =>
    `Please reply with a number of days (e.g. *7*), *END* for end of month, or a date like *15-06-2026*.`,

  invalidPhone: () =>
    `That doesn't look like a valid phone number. Please send a valid Nigerian number.\n\nExample: *08012345678*`,

  // ── Customer verification (number already belongs to a customer) ─────────
  verifyAskCode: (maskedPhone: string) =>
    `🔒 This number already belongs to a customer on Vodium.\n\n` +
    `I've sent a 6-digit code to their WhatsApp (${maskedPhone}). Ask them to read it to you and send it here to confirm — then this credit joins their shared record.`,

  verifyResent: (maskedPhone: string) =>
    `📨 New code sent to the customer's WhatsApp (${maskedPhone}). Send it here once they read it to you.`,

  verifyBadCode: () =>
    `❌ That code is wrong or has expired.\n\nSend the latest code, tap *Resend code*, or *CANCEL* to stop.`,

  /**
   * A BRAND-NEW debtor: the code proves the number is real and its owner is
   * present. Unlike the cross-vendor case there is no existing record to
   * protect, so the vendor may save without the code — verification is the
   * default, never a roadblock (15-second rule).
   */
  verifyNewAskCode: (maskedPhone: string) =>
    `🔐 I've sent a 6-digit code to ${maskedPhone} to confirm the number is really theirs.\n\n` +
    `Ask the customer to read it to you and send it here — a verified number means reminders reach the right person.\n\n` +
    `Can't get the code right now? Tap *Save without code*.`,

  savedUnverified: () =>
    `✅ Saved — number not verified yet. Reminders will still be sent to it; ` +
    `double-check the number if they don't get them.`,

  /**
   * The code could not be DELIVERED (no approved OTP template + the customer
   * has never messaged the bot, so Meta's 24-hour rule blocks free text).
   * Honest + actionable beats pretending it was sent: the customer opening a
   * chat is exactly what unblocks delivery, and Resend then works.
   */
  verifyCantReach: (maskedPhone: string) =>
    `⚠️ I couldn't deliver the code to ${maskedPhone} yet.\n\n` +
    `WhatsApp only lets me message people who have chatted with Vodium before. ` +
    `Ask the customer to send *hi* to this same WhatsApp number now — then tap *Resend code* and it will go through.`,

  verifyDeliveryFailed: () =>
    `⚠️ I couldn't send a code to that number on WhatsApp. It may not be on WhatsApp. Ask the customer to message the Vodium bot first, then try again — or add the credit from your dashboard.`,

  noVendorAccount: () =>
    `You don't have a shop set up yet. Reply *START* to get started.`,

  // ── INVOICE flow ───────────────────────────────────────────────────────
  invoiceAskCustomer: () =>
    `Let's create an invoice. 🧾 Who is it for? Send the customer's full name.\n\n` +
    `Example: *Chidi Okeke*`,

  invoiceAskPhone: (customerName: string) =>
    `What is *${customerName}'s* WhatsApp number?\n\n` +
    `Type it, or tap 📎 and *share their contact*. The invoice goes to them there.\n\n` +
    `Example: *08012345678*`,

  invoiceAskItems: (customerName: string) =>
    `Now add the items for *${customerName}*, one per message:\n\n` +
    `• *Rice, 2, 1500* : item, quantity, unit price\n` +
    `• *Delivery, 500* : item, price (quantity 1)\n\n` +
    `Send *DONE* when you've added everything.`,

  invoiceItemAdded: (items: InvoiceItemEntry[]) => {
    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    return (
      `✓ Added.\n\n` +
      `${invoiceItemLines(items)}\n` +
      `*Total so far: ${formatNaira(total)}*\n\n` +
      `Add another item, or send *DONE* to continue.`
    );
  },

  invoiceInvalidItem: () =>
    `I couldn't read that item. Send it like:\n\n` +
    `*Rice, 2, 1500* : item, quantity, unit price\n\n` +
    `Or send *DONE* if you've finished.`,

  invoiceNeedItem: () =>
    `Add at least one item first.\n\nExample: *Rice, 2, 1500*`,

  invoiceAskDue: (customerName: string) =>
    `When should *${customerName}* pay? Reply with:\n` +
    `• *7* : in 7 days\n` +
    `• *END* : end of month\n` +
    `• *15-06-2026* : a specific date`,

  invoiceConfirm: (customerName: string, items: InvoiceItemEntry[], total: number, dueText: string) =>
    `🧾 *Invoice for ${customerName}*\n\n` +
    `${invoiceItemLines(items)}\n\n` +
    `*Total: ${formatNaira(total)}*\n` +
    `Due ${dueText}.\n\n` +
    `Send *SEND* to create it and deliver it to *${customerName}* on WhatsApp, or *CANCEL* to discard.`,

  invoiceConfirmHint: () =>
    `Reply *SEND* to send the invoice, or *CANCEL* to discard it.`,

  invoiceSent: (customerName: string, invoiceNumber: string, total: number) =>
    `✅ Invoice *${invoiceNumber}* for *${formatNaira(total)}* is on its way to *${customerName}* on WhatsApp.\n\n` +
    `If it's not paid by the due date, I'll send them a polite reminder. You can track it under *Invoices* on your dashboard.`,

  invoiceSendFailed: (invoiceNumber: string, link: string) =>
    `⚠️ I created invoice *${invoiceNumber}* but couldn't deliver it on WhatsApp.\n\n` +
    `Share this link with the customer instead:\n${link}`,

  // ── LIST ───────────────────────────────────────────────────────────────
  listEmpty: () => `🎉 No outstanding credits, you're all settled up!`,

  listFull: (credits: CreditEntry[]) => {
    const total = credits.reduce((s, c) => s + c.amount, 0);
    const header =
      `📋 *${credits.length} outstanding credit${credits.length === 1 ? "" : "s"}* — ` +
      `${formatNaira(total)} total owed to you:\n\n`;

    const rows = credits
      .map((c, i) => {
        let due: string;
        let flag = "";
        if (c.daysUntilDue < 0) {
          due = `overdue by ${Math.abs(c.daysUntilDue)} day${Math.abs(c.daysUntilDue) === 1 ? "" : "s"}`;
          flag = " 🔴";
        } else if (c.daysUntilDue === 0) {
          due = "due TODAY";
          flag = " ⚠️";
        } else if (c.daysUntilDue <= 3) {
          due = `due in ${c.daysUntilDue} day${c.daysUntilDue === 1 ? "" : "s"}`;
          flag = " ⚠️";
        } else {
          due = `due in ${c.daysUntilDue} days`;
        }
        return `${i + 1}. *${c.customerName}* : ${formatNaira(c.amount)} (${due}${flag})`;
      })
      .join("\n");

    const footer =
      `\n\nReply *PAID [name]* to mark as paid.\n` +
      `Reply *SCORE [name]* to check their reliability.`;

    return header + rows + footer;
  },

  // ── PAID flow ──────────────────────────────────────────────────────────
  paidAsk: () => `Who paid? Send their full name.\n\nExample: *Chidi Okeke*`,

  paidConfirmed: (customerName: string, amount: number) =>
    `✅ Marked *${customerName}'s* ${formatNaira(amount)} as *paid*.\n\n` +
    `Their Vodium score has improved. Reply *LIST* to see remaining credits.`,

  paidNotFound: (customerName: string) =>
    `❌ No outstanding credit found for *${customerName}*.\n\n` +
    `Check the spelling and try again, or reply *LIST* to see all credits.`,

  // ── SCORE lookup ───────────────────────────────────────────────────────
  scoreLookupAsk: () => `Which customer? Send their full name or phone number.`,

  scoreReply: (customerName: string, score: number, summary: string) => {
    const band =
      score >= 750
        ? "🟢 Excellent"
        : score >= 650
          ? "🟡 Good"
          : score >= 500
            ? "🟡 Building"
            : score >= 350
              ? "🟠 Risky"
              : "🔴 High risk";

    return (
      `📊 *${customerName}* : Vodium Score: *${score}/1000*\n` +
      `${band}\n\n` +
      `${summary}\n\n` +
      `_Scores above 650 indicate good repayment history across vendors._`
    );
  },

  scoreNotFound: (query: string) =>
    `❌ No customer found matching *"${query}"*.\n\n` +
    `Check the spelling or try their phone number.`,

  scoreNoHistory: (customerName: string) =>
    `📊 *${customerName}* : Vodium Score: *500/1000*\n` +
    `🔵 New : no credit history yet.\n\n` +
    `This customer has no recorded credits on Vodium.`,

  // ── Customer payment claims (vendor must confirm before anything changes) ──
  paidWhichRole: () =>
    `You have credit of your own to settle, and you also have customers. What do you mean by *PAID*?`,

  claimNoCredit: () =>
    `You have no outstanding credit recorded on Vodium. 🎉\n\n` +
    `If you think this is a mistake, please contact your vendor directly.`,

  claimAckToCustomer: (vendorNames: string[]) => {
    const who =
      vendorNames.length === 1
        ? `*${vendorNames[0]}*`
        : vendorNames.map((v) => `*${v}*`).join(", ");
    return (
      `Thanks for letting me know! 🙏\n\n` +
      `I've told ${who} that you've paid. They'll confirm once they receive it — ` +
      `your Vodium score improves the moment they do.`
    );
  },

  claimToVendor: (customerName: string, amount: number) =>
    `💰 *${customerName}* says they've paid you *${formatNaira(amount)}*.\n\n` +
    `Tap *Confirm received* once you have the money — their credit is marked paid ` +
    `and their score updates only after you confirm.`,

  claimConfirmedToCustomer: (vendorBusinessName: string, amount: number) =>
    `✅ *${vendorBusinessName}* confirmed your payment of *${formatNaira(amount)}*.\n\n` +
    `Your Vodium score just improved. Thank you for paying on time! 🎉`,

  claimDisputedToCustomer: (vendorBusinessName: string, amount: number) =>
    `*${vendorBusinessName}* hasn't received your payment of *${formatNaira(amount)}* yet.\n\n` +
    `If you've already paid, please reach out to them directly so they can confirm.`,

  claimDisputeNoted: (customerName: string) =>
    `Noted. I've let *${customerName}* know you haven't received it. The credit stays open.`,

  confirmNotFound: () =>
    `That credit is already settled or no longer open. Reply *LIST* to see what's outstanding.`,

  // ── Customer disputes ("this credit isn't mine") ────────────────────────
  disputeAckToCustomer: (vendorBusinessName: string, amount: number) =>
    `🛡️ Thank you for telling us.\n\n` +
    `We've opened a review of the *${formatNaira(amount)}* from *${vendorBusinessName}*. ` +
    `Our team will look into it and get back to you.\n\n` +
    `While it's under review we won't count it against your Vodium score.`,

  disputeAlreadyOpen: () =>
    `You've already reported this one. 👍 Our team is reviewing it and will get back to you.`,

  disputeNothingToDispute: () =>
    `You have no open credit to report right now.\n\n` +
    `If you got a reminder you don't recognise, tap *Not my credit* on that message.`,

  disputePickFromReminder: () =>
    `You have credit at more than one shop, so I'm not sure which one you mean.\n\n` +
    `Please tap *Not my credit* on the reminder for the one you don't recognise.`,

  disputeToVendor: (customerName: string, amount: number) =>
    `⚠️ *${customerName}* says the *${formatNaira(amount)}* you recorded is not theirs.\n\n` +
    `Our team is reviewing it. No action needed from you — we'll be in touch if we need details.`,

  disputeUpheldToCustomer: (vendorBusinessName: string, amount: number) =>
    `✅ Review complete — you were right.\n\n` +
    `The *${formatNaira(amount)}* from *${vendorBusinessName}* has been removed and it will not affect your Vodium score.`,

  disputeRejectedToCustomer: (vendorBusinessName: string, amount: number) =>
    `Review complete.\n\n` +
    `We checked with *${vendorBusinessName}* and the *${formatNaira(amount)}* stands. ` +
    `If you still disagree, please reply here and a human will help.`,

  // ── Escalation: firmer follow-up after a reminder goes unanswered ────────
  escalationToCustomer: (customerName: string, vendorBusinessName: string, amount: number, payTo = "") =>
    `Hi *${customerName}*,\n\n` +
    `This is a follow-up from *${vendorBusinessName}* — your balance of *${formatNaira(amount)}* is still open and we haven't heard back.` +
    payTo +
    `\n\nPlease settle it as soon as you can, or reply here to let them know when you'll pay. Paying keeps your Vodium score healthy for future credit. 🙏`,

  // ── Proactive reminders (sent to customers) ─────────────────────────────
  reminderToCustomer: (
    customerName: string,
    vendorBusinessName: string,
    amount: number,
    dueDateText: string,
    payTo = "",
  ) =>
    `Hi *${customerName}* 👋\n\n` +
    `Friendly reminder from *${vendorBusinessName}*: you have *${formatNaira(amount)}* due ${dueDateText}.` +
    payTo +
    `\n\nPaying on time builds your Vodium credit score, it'll help you access better products in future.\n\n` +
    `Reply *PAID* once you've settled.`,

  // ── Vendor payout details (shown to customers on reminders) ─────────────
  bankAskName: () =>
    `Let's add your payment details so customers can pay you directly from a reminder. 🏦\n\n` +
    `Which bank? Send the name.\n\nExample: *GTBank*`,

  bankAskNumber: (bankName: string) =>
    `Got it — *${bankName}*.\n\nWhat's the account number?\n\nExample: *0123456789*`,

  bankAskAccountName: () =>
    `And the account name exactly as it appears at the bank?\n\nExample: *Mama Bisi Provisions*`,

  bankInvalidNumber: () =>
    `That doesn't look like an account number. Send the digits only.\n\nExample: *0123456789*`,

  bankSaved: (bankName: string, accountNumber: string, accountName: string) =>
    `✅ Saved.\n\n🏦 *${bankName}* — ${accountNumber}\n${accountName}\n\n` +
    `From now on every reminder I send your customers will show these details, so they can pay without asking you. Reply *ACCOUNT* any time to change them.`,

  // ── HELP & misc ────────────────────────────────────────────────────────
  help: () =>
    `*Vodium Ledger commands:*\n\n` +
    `• *ADD Chidi 08012345678 2500 7d* : log a credit in one message\n` +
    `• *ADD* : record a credit step by step\n` +
    `• *INVOICE* : create & send an invoice\n` +
    `• *PAID [name]* : mark a credit paid\n` +
    `• *LIST* : see who owes you\n` +
    `• *SCORE [name]* : check a customer's reliability\n` +
    `• *ACCOUNT* : set the bank details shown on reminders\n` +
    `• *DASHBOARD* : get a link to your full dashboard\n` +
    `• *SUPPORT* : talk to a human`,


  unknown: () =>
    `Sorry, I didn't catch that. Reply *HELP* to see what I can do.`,

  cancelled: () =>
    `No problem. I've cancelled that flow.\n\nReply *ADD* to record a credit, or *HELP* to see all commands.`,
};
