/**
 * Vodium Ledger — invoice PDF.
 *
 * Rendered with @react-pdf/renderer so we can embed real fonts. That matters
 * for one specific reason: the Naira sign (U+20A6). The previous hand-rolled
 * generator used base Helvetica, which has no ₦ glyph, and stripped every
 * non-ASCII character — so every amount on every invoice printed with a blank
 * where the currency should be.
 *
 * FONT RULE — DO NOT BREAK: Playfair Display has NO ₦ glyph (verified against
 * the shipped file). Any text containing money MUST use Inter. Playfair is for
 * headings and the shop name only. Putting a formatted amount in a Playfair
 * <Text> silently drops the ₦ and reintroduces the original bug.
 *
 * The four .ttf files in ./fonts are subsetted to Latin-1 + ₦ + typographic
 * punctuation (~130KB total) and are bundled into the serverless function via
 * `outputFileTracingIncludes` in next.config.js.
 */

import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { formatNaira } from "@/lib/utils";

type InvoicePdfInput = {
  invoiceNumber: string;
  status: string;
  createdAt: Date;
  dueDate: Date;
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  notes?: string | null;
  store: {
    name: string;
    ownerName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    branchName?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  customer: {
    name: string;
    phone: string;
    customerId?: string | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

/* ------------------------------------------------------------------ */
/* Brand tokens (CLAUDE.md)                                           */
/* ------------------------------------------------------------------ */

const BLACK = "#0A0A0A";
const GOLD = "#C9A961";
const CREAM = "#FAFAF7";
const CHARCOAL = "#1F1F1F";
const SUCCESS = "#16A34A";
const WARNING = "#D97706";
const DANGER = "#DC2626";
const MUTED = "#6B6B66";
const HAIRLINE = "#E5E3DC";

/* ------------------------------------------------------------------ */
/* Fonts                                                              */
/* ------------------------------------------------------------------ */

const FONT_DIR = path.join(process.cwd(), "src", "lib", "fonts");

/** Registration is global and must happen exactly once per process. */
let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Playfair",
    fonts: [{ src: path.join(FONT_DIR, "PlayfairDisplay-Bold.ttf"), fontWeight: 700 }],
  });
  // Our subset has no hyphenation dictionary; without this react-pdf breaks
  // long words at arbitrary points and inserts stray hyphens into names.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export function invoicePdfFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
}

/* ------------------------------------------------------------------ */
/* Status                                                             */
/* ------------------------------------------------------------------ */

function labelStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Maps a status to its badge colour, following the brand's semantic tokens. */
function statusColour(status: string, balanceDue: number): string {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "SETTLED") return SUCCESS;
  if (s === "OVERDUE") return DANGER;
  if (s === "CANCELLED" || s === "VOID") return MUTED;
  if (balanceDue <= 0) return SUCCESS;
  return WARNING;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: BLACK,
    backgroundColor: "#FFFFFF",
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 0,
  },
  goldBar: { height: 6, backgroundColor: GOLD },

  header: {
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 22,
    backgroundColor: BLACK,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shopName: {
    fontFamily: "Playfair",
    fontWeight: 700,
    fontSize: 22,
    color: "#FFFFFF",
    maxWidth: 300,
  },
  shopMetaLine: { fontSize: 8, color: "#B9B7B0", marginTop: 3 },
  invoiceWord: {
    fontFamily: "Playfair",
    fontWeight: 700,
    fontSize: 13,
    color: GOLD,
    letterSpacing: 3,
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 11,
    fontWeight: 700,
    color: "#FFFFFF",
    marginTop: 5,
    textAlign: "right",
  },
  badge: {
    marginTop: 9,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 3,
    alignSelf: "flex-end",
  },
  badgeText: { fontSize: 8, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.8 },

  datesRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: CHARCOAL,
    paddingHorizontal: 40,
    paddingVertical: 8,
  },
  dateCell: { marginLeft: 26, alignItems: "flex-end" },
  dateLabel: { fontSize: 7, color: "#8C8A84", letterSpacing: 0.8 },
  dateValue: { fontSize: 9, color: "#FFFFFF", fontWeight: 600, marginTop: 2 },

  body: { paddingHorizontal: 40, paddingTop: 22 },

  panels: { flexDirection: "row", marginBottom: 20 },
  panel: { flex: 1 },
  panelDivider: { width: 24 },
  panelLabel: {
    fontSize: 7,
    color: GOLD,
    fontWeight: 700,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  panelName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  panelLine: { fontSize: 8.5, color: MUTED, marginBottom: 2 },

  tableHead: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeadText: { fontSize: 7, fontWeight: 700, color: CHARCOAL, letterSpacing: 0.9 },
  row: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#F2F0EA",
  },
  rowAlt: { backgroundColor: "#FCFCFA" },

  colDesc: { flex: 1, paddingRight: 10 },
  colQty: { width: 42, textAlign: "right" },
  colUnit: { width: 82, textAlign: "right" },
  colTotal: { width: 88, textAlign: "right" },
  cell: { fontSize: 9 },
  cellMuted: { fontSize: 8, color: MUTED, marginTop: 2 },

  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalsBox: { width: 250 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 9, color: MUTED },
  totalsValue: { fontSize: 9, fontWeight: 600 },
  totalsRule: { borderTopWidth: 1, borderColor: HAIRLINE, marginVertical: 5 },

  balanceBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BLACK,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginTop: 7,
  },
  balanceLabel: { fontSize: 8, color: GOLD, fontWeight: 700, letterSpacing: 1 },
  balanceValue: { fontSize: 16, color: "#FFFFFF", fontWeight: 700 },

  payBox: {
    marginTop: 22,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 4,
    padding: 13,
  },
  payLabel: { fontSize: 7, color: GOLD, fontWeight: 700, letterSpacing: 1.2, marginBottom: 6 },
  payGrid: { flexDirection: "row" },
  payCell: { flex: 1 },
  payCellLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.5 },
  payCellValue: { fontSize: 10, fontWeight: 700, marginTop: 2 },

  notesBox: { marginTop: 18 },
  notesLabel: { fontSize: 7, color: GOLD, fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 },
  notesText: { fontSize: 8.5, color: CHARCOAL, lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderColor: HAIRLINE,
    paddingTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: MUTED },
  footerBrand: { fontSize: 7, color: MUTED },
});

/* ------------------------------------------------------------------ */
/* Document                                                           */
/* ------------------------------------------------------------------ */

function InvoiceDocument({ input }: { input: InvoicePdfInput }): React.ReactElement {
  const balanceDue = Math.max(0, input.total - input.amountPaid);
  const badgeColour = statusColour(input.status, balanceDue);
  const hasBank = Boolean(
    input.store.bankName || input.store.bankAccountNumber || input.store.bankAccountName,
  );

  const storeMeta = [
    input.store.branchName,
    input.store.address,
    input.store.phone,
    input.store.email,
  ].filter((v): v is string => Boolean(v && v.trim()));

  return React.createElement(
    Document,
    {
      title: `Invoice ${input.invoiceNumber}`,
      author: input.store.name,
      subject: `Invoice ${input.invoiceNumber} for ${input.customer.name}`,
      creator: "Vodium Ledger",
      producer: "Vodium Ledger",
    },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      React.createElement(View, { style: styles.goldBar, fixed: true }),

      // Header — shop identity + invoice number + status
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: { flex: 1, paddingRight: 16 } },
          React.createElement(Text, { style: styles.shopName }, input.store.name),
          ...storeMeta.slice(0, 3).map((line, i) =>
            React.createElement(Text, { key: `meta-${i}`, style: styles.shopMetaLine }, line),
          ),
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.invoiceWord }, "INVOICE"),
          React.createElement(Text, { style: styles.invoiceNumber }, input.invoiceNumber),
          React.createElement(
            View,
            { style: [styles.badge, { backgroundColor: badgeColour }] },
            React.createElement(
              Text,
              { style: styles.badgeText },
              labelStatus(input.status).toUpperCase(),
            ),
          ),
        ),
      ),

      // Dates strip
      React.createElement(
        View,
        { style: styles.datesRow },
        React.createElement(
          View,
          { style: styles.dateCell },
          React.createElement(Text, { style: styles.dateLabel }, "ISSUED"),
          React.createElement(Text, { style: styles.dateValue }, formatDate(input.createdAt)),
        ),
        React.createElement(
          View,
          { style: styles.dateCell },
          React.createElement(Text, { style: styles.dateLabel }, "DUE"),
          React.createElement(Text, { style: styles.dateValue }, formatDate(input.dueDate)),
        ),
      ),

      React.createElement(
        View,
        { style: styles.body },

        // From / Bill to
        React.createElement(
          View,
          { style: styles.panels },
          React.createElement(
            View,
            { style: styles.panel },
            React.createElement(Text, { style: styles.panelLabel }, "FROM"),
            React.createElement(Text, { style: styles.panelName }, input.store.name),
            ...(input.store.ownerName
              ? [React.createElement(Text, { key: "owner", style: styles.panelLine }, input.store.ownerName)]
              : []),
            ...(input.store.address
              ? [React.createElement(Text, { key: "addr", style: styles.panelLine }, input.store.address)]
              : []),
            ...(input.store.phone
              ? [React.createElement(Text, { key: "phone", style: styles.panelLine }, input.store.phone)]
              : []),
            ...(input.store.email
              ? [React.createElement(Text, { key: "email", style: styles.panelLine }, input.store.email)]
              : []),
          ),
          React.createElement(View, { style: styles.panelDivider }),
          React.createElement(
            View,
            { style: styles.panel },
            React.createElement(Text, { style: styles.panelLabel }, "BILL TO"),
            React.createElement(Text, { style: styles.panelName }, input.customer.name),
            React.createElement(Text, { style: styles.panelLine }, input.customer.phone),
            ...(input.customer.customerId
              ? [
                  React.createElement(
                    Text,
                    { key: "cid", style: styles.panelLine },
                    `ID: ${input.customer.customerId}`,
                  ),
                ]
              : []),
          ),
        ),

        // Items table
        React.createElement(
          View,
          { style: styles.tableHead },
          React.createElement(Text, { style: [styles.tableHeadText, styles.colDesc] }, "DESCRIPTION"),
          React.createElement(Text, { style: [styles.tableHeadText, styles.colQty] }, "QTY"),
          React.createElement(Text, { style: [styles.tableHeadText, styles.colUnit] }, "UNIT PRICE"),
          React.createElement(Text, { style: [styles.tableHeadText, styles.colTotal] }, "AMOUNT"),
        ),
        ...input.items.map((item, i) =>
          React.createElement(
            View,
            { key: `item-${i}`, style: i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row, wrap: false },
            React.createElement(
              View,
              { style: styles.colDesc },
              React.createElement(Text, { style: styles.cell }, item.name),
            ),
            React.createElement(Text, { style: [styles.cell, styles.colQty] }, String(item.quantity)),
            React.createElement(
              Text,
              { style: [styles.cell, styles.colUnit] },
              formatNaira(item.unitPrice),
            ),
            React.createElement(
              Text,
              { style: [styles.cell, styles.colTotal, { fontWeight: 600 }] },
              formatNaira(item.totalPrice),
            ),
          ),
        ),

        // Totals
        React.createElement(
          View,
          { style: styles.totals },
          React.createElement(
            View,
            { style: styles.totalsBox },
            React.createElement(
              View,
              { style: styles.totalsRow },
              React.createElement(Text, { style: styles.totalsLabel }, "Subtotal"),
              React.createElement(Text, { style: styles.totalsValue }, formatNaira(input.subtotal)),
            ),
            ...(input.discountAmount > 0
              ? [
                  React.createElement(
                    View,
                    { key: "disc", style: styles.totalsRow },
                    React.createElement(Text, { style: styles.totalsLabel }, "Discount"),
                    React.createElement(
                      Text,
                      { style: [styles.totalsValue, { color: SUCCESS }] },
                      `- ${formatNaira(input.discountAmount)}`,
                    ),
                  ),
                ]
              : []),
            React.createElement(View, { style: styles.totalsRule }),
            React.createElement(
              View,
              { style: styles.totalsRow },
              React.createElement(Text, { style: [styles.totalsLabel, { color: BLACK }] }, "Total"),
              React.createElement(
                Text,
                { style: [styles.totalsValue, { fontSize: 11, fontWeight: 700 }] },
                formatNaira(input.total),
              ),
            ),
            ...(input.amountPaid > 0
              ? [
                  React.createElement(
                    View,
                    { key: "paid", style: styles.totalsRow },
                    React.createElement(Text, { style: styles.totalsLabel }, "Paid"),
                    React.createElement(
                      Text,
                      { style: [styles.totalsValue, { color: SUCCESS }] },
                      `- ${formatNaira(input.amountPaid)}`,
                    ),
                  ),
                ]
              : []),
            React.createElement(
              View,
              { style: styles.balanceBox },
              React.createElement(Text, { style: styles.balanceLabel }, "BALANCE DUE"),
              React.createElement(Text, { style: styles.balanceValue }, formatNaira(balanceDue)),
            ),
          ),
        ),

        // Payment details
        ...(hasBank
          ? [
              React.createElement(
                View,
                { key: "pay", style: styles.payBox, wrap: false },
                React.createElement(Text, { style: styles.payLabel }, "HOW TO PAY"),
                React.createElement(
                  View,
                  { style: styles.payGrid },
                  ...(input.store.bankName
                    ? [
                        React.createElement(
                          View,
                          { key: "bank", style: styles.payCell },
                          React.createElement(Text, { style: styles.payCellLabel }, "BANK"),
                          React.createElement(Text, { style: styles.payCellValue }, input.store.bankName),
                        ),
                      ]
                    : []),
                  ...(input.store.bankAccountNumber
                    ? [
                        React.createElement(
                          View,
                          { key: "acct", style: styles.payCell },
                          React.createElement(Text, { style: styles.payCellLabel }, "ACCOUNT NUMBER"),
                          React.createElement(
                            Text,
                            { style: styles.payCellValue },
                            input.store.bankAccountNumber,
                          ),
                        ),
                      ]
                    : []),
                  ...(input.store.bankAccountName
                    ? [
                        React.createElement(
                          View,
                          { key: "acctname", style: styles.payCell },
                          React.createElement(Text, { style: styles.payCellLabel }, "ACCOUNT NAME"),
                          React.createElement(
                            Text,
                            { style: styles.payCellValue },
                            input.store.bankAccountName,
                          ),
                        ),
                      ]
                    : []),
                ),
              ),
            ]
          : []),

        // Notes
        ...(input.notes
          ? [
              React.createElement(
                View,
                { key: "notes", style: styles.notesBox },
                React.createElement(Text, { style: styles.notesLabel }, "NOTES"),
                React.createElement(Text, { style: styles.notesText }, input.notes),
              ),
            ]
          : []),
      ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText },
          "Please contact the vendor if anything on this invoice looks wrong.",
        ),
        React.createElement(Text, { style: styles.footerBrand }, "Generated by Vodium Ledger"),
      ),
    ),
  );
}

/**
 * Render the invoice to a PDF buffer.
 *
 * NOTE: async, unlike the previous synchronous implementation — react-pdf
 * layout is promise-based. Callers must await.
 */
export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  registerFonts();
  // Call the builder directly rather than wrapping it in a component element:
  // renderToBuffer expects the <Document> element itself, not a component whose
  // props are the invoice.
  return renderToBuffer(InvoiceDocument({ input }));
}
