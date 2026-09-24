/**
 * Vodium Ledger — deterministic language understanding for the bot.
 *
 * No AI, no network, no dependencies: normalisation, alias tables and edit
 * distance. Everything here is pure and unit-testable, which matters because
 * this layer decides what a vendor's message *means* — a wrong guess sends
 * someone down the wrong flow.
 *
 * Design rules:
 *   1. Exact commands always win, so existing behaviour can never regress.
 *   2. Then whole-phrase matches, then keywords, then typo-tolerant matching.
 *   3. Typo tolerance is tight (1–2 edits, scaled to word length). Being too
 *      generous is worse than being strict: silently running the wrong command
 *      on someone's ledger is a far worse failure than asking them to repeat.
 *
 * Written for how Nigerian campus vendors actually type — lowercase, no
 * punctuation, Pidgin, and "abeg" in front of everything.
 */

export type NluIntent =
  | "START" | "ADD" | "INSTALLMENT" | "INVOICE" | "PAID" | "LIST" | "SCORE"
  | "HELP" | "DASHBOARD" | "SUPPORT" | "BANK" | "FREE_TEXT";

/** Lowercase, strip emoji/punctuation/accents, collapse whitespace. */
export function normalise(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")            // accents
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ") // emoji
    .toLowerCase()
    .replace(/[^\w\s+]/g, " ")                   // punctuation (keep + for phones)
    .replace(/\s+/g, " ")
    .trim();
}

/** Filler words that carry no intent — dropped before matching. */
const FILLER = new Set([
  "abeg", "please", "pls", "plz", "i", "want", "to", "wan", "make", "do",
  "can", "you", "u", "me", "my", "the", "a", "for", "am", "wanna", "let",
  "us", "we", "go", "dey", "na", "sir", "ma", "hello", "hi", "hey", "good",
  "morning", "afternoon", "evening", "how", "help",
]);

/**
 * Damerau–Levenshtein distance (optimal string alignment).
 *
 * Counts a swap of adjacent letters as ONE edit, not two — which matters
 * because transposition is the most common real typing error on a phone
 * keyboard: "hlep" for "help", "recieve" for "receive". Plain Levenshtein
 * scores those as 2 and would reject them under a tight budget.
 *
 * Inputs here are single command words, so the O(n·m) matrix is negligible.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,        // deletion
        d[i][j - 1] + 1,        // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      // Adjacent transposition — "hlep" ↔ "help" costs 1, not 2.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[a.length][b.length];
}

/** Typo tolerance scaled to length: short words get no slack, long words get 2. */
export function isTypoOf(word: string, target: string): boolean {
  if (word === target) return true;
  if (target.length <= 3) return false;                 // "add" must be exact
  const budget = target.length <= 5 ? 1 : 2;
  return editDistance(word, target) <= budget;
}

/**
 * Intent vocabulary. `exact` preserves today's commands verbatim; `phrases`
 * match anywhere in the message; `words` match a single token (with typo
 * tolerance). Order in this table does not matter — precedence is by match
 * strength, below.
 */
const VOCAB: Array<{
  intent: NluIntent;
  exact: string[];
  phrases: string[];
  words: string[];
}> = [
  {
    intent: "INSTALLMENT",
    exact: ["installment", "instalment", "bnpl"],
    phrases: ["installment plan", "instalment plan", "pay in parts", "buy now pay later", "pay later"],
    words: ["installment", "instalment", "bnpl"],
  },
  {
    intent: "ADD",
    exact: ["add", "new", "credit"],
    phrases: [
      "add credit", "new credit", "record credit", "log credit", "give credit",
      "add debt", "new debt", "record debt", "book am", "put am for book",
      "someone collect", "person collect", "add customer",
    ],
    words: ["add", "record", "log", "lend", "borrow", "credit", "debt"],
  },
  {
    intent: "LIST",
    exact: ["list", "owe", "owing", "who"],
    phrases: [
      "who is owing", "who dey owe", "who owe me", "who are owing",
      "show my list", "my debtors", "outstanding credit", "see debtors",
      "how much dem owe", "wetin dem owe", "check my book", "my book",
    ],
    words: ["list", "owing", "owe", "debtors", "debtor", "outstanding", "book"],
  },
  {
    intent: "PAID",
    exact: ["paid", "pay", "payment"],
    phrases: [
      "mark as paid", "mark paid", "he paid", "she paid", "they paid",
      "customer paid", "don pay", "has paid", "settle", "cleared",
    ],
    words: ["paid", "settled", "cleared"],
  },
  {
    intent: "INVOICE",
    exact: ["invoice", "bill"],
    phrases: ["send invoice", "create invoice", "make invoice", "new invoice", "send bill"],
    words: ["invoice", "bill", "receipt"],
  },
  {
    intent: "SCORE",
    exact: ["score", "rating", "reliability"],
    phrases: [
      "check score", "credit score", "how reliable", "can i trust",
      "is he good", "is she good", "check customer",
    ],
    words: ["score", "rating", "trust", "reliable", "reliability"],
  },
  {
    intent: "BANK",
    exact: ["account", "bank", "payment"],
    phrases: [
      "my account", "account details", "bank details", "account number",
      "add my account", "set my bank", "payment details", "where they go pay",
    ],
    words: ["account", "bank"],
  },
  {
    intent: "DASHBOARD",
    exact: ["dashboard", "web", "portal", "website"],
    phrases: ["open dashboard", "web dashboard", "my dashboard", "see online"],
    words: ["dashboard", "portal", "website"],
  },
  {
    intent: "SUPPORT",
    exact: ["support", "agent", "human"],
    phrases: [
      "talk to human", "speak to someone", "customer care", "i need help from person",
      "call me", "contact support", "real person",
    ],
    words: ["support", "agent", "human", "complain", "complaint"],
  },
  {
    intent: "START",
    exact: ["start", "begin", "hi", "hello", "hey"],
    phrases: ["get started", "set up my shop", "register my shop", "sign up"],
    words: ["start", "begin", "register"],
  },
  {
    intent: "HELP",
    exact: ["help", "?", "menu", "commands", "options"],
    phrases: ["what can you do", "show me commands", "how does this work", "show menu"],
    words: ["help", "menu", "commands", "options"],
  },
];

/**
 * Resolve a message to an intent. Returns FREE_TEXT when nothing matches
 * confidently — the bot then asks rather than guessing.
 */
export function matchIntent(input: string): NluIntent {
  const text = normalise(input);
  if (!text) return "FREE_TEXT";

  // 1. Exact command — today's behaviour, never broken.
  for (const entry of VOCAB) {
    if (entry.exact.includes(text)) return entry.intent;
  }

  // 2. Command with arguments: "paid chidi", "score ada", "add chidi 0803… 2500".
  const firstWord = text.split(" ")[0];
  for (const entry of VOCAB) {
    if (entry.exact.includes(firstWord) && text.length > firstWord.length) {
      return entry.intent;
    }
  }

  // 3. Whole-phrase match anywhere in the message.
  for (const entry of VOCAB) {
    for (const phrase of entry.phrases) {
      if (text.includes(phrase)) return entry.intent;
    }
  }

  // 4. Keyword match on meaningful tokens (filler stripped).
  const tokens = text.split(" ").filter((t) => t && !FILLER.has(t));
  for (const entry of VOCAB) {
    for (const token of tokens) {
      if (entry.words.includes(token)) return entry.intent;
    }
  }

  // 5. Typo tolerance — only on a short message, so a long sentence with one
  //    near-miss word can't hijack a command.
  if (tokens.length <= 3) {
    for (const entry of VOCAB) {
      for (const token of tokens) {
        for (const target of entry.words) {
          if (isTypoOf(token, target)) return entry.intent;
        }
      }
    }
  }

  return "FREE_TEXT";
}

/**
 * Tight match for the two commands that must work mid-flow without ever
 * hijacking a customer's name. Exact plus at most one typo.
 */
export function isEscapeCommand(input: string, command: "help" | "cancel"): boolean {
  const text = normalise(input);
  if (!text) return false;
  const aliases = command === "help"
    ? ["help", "menu", "commands", "?"]
    : ["cancel", "stop", "quit", "exit", "abort", "nevermind", "never mind"];
  if (aliases.includes(text)) return true;
  // Single word only — "cancel my credit for chidi" should not abort blindly.
  return !text.includes(" ") && aliases.some((a) => a.length > 3 && isTypoOf(text, a));
}

const AFFIRMATIVE = [
  "yes", "y", "yeah", "yep", "yup", "ok", "okay", "sure", "fine", "correct",
  "right", "true", "confirm", "confirmed", "save", "go", "proceed", "continue",
  "na so", "oya", "sharp", "done",
];

const NEGATIVE = [
  "no", "n", "nope", "nah", "dont", "don t", "do not", "stop", "skip",
  "negative", "wrong", "false", "no o", "abeg no",
];

export function isAffirmative(input: string): boolean {
  const text = normalise(input);
  if (!text) return false;
  if (AFFIRMATIVE.includes(text)) return true;
  return !text.includes(" ") && AFFIRMATIVE.some((a) => a.length > 3 && isTypoOf(text, a));
}

export function isNegative(input: string): boolean {
  const text = normalise(input);
  if (!text) return false;
  if (NEGATIVE.includes(text)) return true;
  return !text.includes(" ") && NEGATIVE.some((a) => a.length > 3 && isTypoOf(text, a));
}
