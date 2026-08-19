/**
 * Vodium Ledger — weekly vendor report PDF.
 *
 * Rendered with @react-pdf/renderer, same as lib/invoice-pdf.ts.
 *
 * FONT RULE — DO NOT BREAK: Playfair Display has NO ₦ glyph. Any text
 * containing money MUST use Inter. Playfair is for headings and the shop name
 * only. Putting a formatted amount in a Playfair <Text> silently drops the ₦
 * and prints a blank where the currency should be. The page style below sets
 * Inter as the default precisely so the safe choice is the lazy one — every
 * Playfair style in this file is checked to be money-free.
 */

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { formatNaira } from "@/lib/utils";
import { registerPdfFonts } from "@/lib/invoice-pdf";
import { formatWeekRange, type WeeklyReportData } from "@/lib/weekly-report";

/* Brand tokens (CLAUDE.md) */
const BLACK = "#0A0A0A";
const GOLD = "#C9A961";
const SUCCESS = "#16A34A";
const WARNING = "#D97706";
const MUTED = "#6B6B66";
const HAIRLINE = "#E5E3DC";

export function weeklyReportPdfFilename(shopName: string, weekStart: Date): string {
  const slug = shopName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
  return `${slug}-week-${weekStart.toISOString().slice(0, 10)}.pdf`;
}

const styles = StyleSheet.create({
  // Inter is the default for the whole page — see the FONT RULE above.
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: BLACK,
    backgroundColor: "#FFFFFF",
    paddingBottom: 48,
  },
  goldBar: { height: 6, backgroundColor: GOLD },

  header: { paddingHorizontal: 40, paddingTop: 26, paddingBottom: 22, backgroundColor: BLACK },
  // Playfair — shop name only, never money.
  shopName: { fontFamily: "Playfair", fontWeight: 700, fontSize: 22, color: "#FFFFFF", maxWidth: 380 },
  kicker: { fontFamily: "Playfair", fontWeight: 700, fontSize: 11, color: GOLD, letterSpacing: 3, marginBottom: 6 },
  weekLine: { fontSize: 9, color: "#B9B7B0", marginTop: 5 },

  body: { paddingHorizontal: 40, paddingTop: 24 },

  // Tiles are spaced with margins rather than `gap`, matching invoice-pdf.ts —
  // flex gap is not reliably supported across @react-pdf/renderer versions.
  tileRow: { flexDirection: "row", marginBottom: 12 },
  tile: { flex: 1, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 8, padding: 14, marginRight: 12 },
  tileLast: { marginRight: 0 },
  tileLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 7 },
  // Money: Inter, bold. Correct by construction.
  tileValue: { fontSize: 19, fontWeight: 700, color: BLACK },
  tileFoot: { fontSize: 8, color: MUTED, marginTop: 5 },

  sectionTitle: {
    fontFamily: "Playfair", fontWeight: 700, fontSize: 13, color: BLACK,
    marginTop: 14, marginBottom: 8,
  },

  row: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  rowName: { fontSize: 9.5, color: BLACK, flex: 1, paddingRight: 10 },
  rowAmount: { fontSize: 9.5, fontWeight: 600, color: BLACK },

  summaryBox: {
    marginTop: 16, padding: 14, borderRadius: 8,
    backgroundColor: "#FAFAF7", borderWidth: 1, borderColor: HAIRLINE,
  },
  summaryLine: { fontSize: 9.5, color: "#3F3F3A", lineHeight: 1.55 },

  footer: {
    position: "absolute", bottom: 22, left: 40, right: 40,
    fontSize: 7.5, color: MUTED, textAlign: "center",
  },
});

function tile(label: string, value: string, foot: string, colour?: string, last = false) {
  return React.createElement(
    View,
    { style: last ? [styles.tile, styles.tileLast] : styles.tile },
    React.createElement(Text, { style: styles.tileLabel }, label),
    React.createElement(Text, { style: colour ? [styles.tileValue, { color: colour }] : styles.tileValue }, value),
    React.createElement(Text, { style: styles.tileFoot }, foot)
  );
}

export async function generateWeeklyReportPdf(data: WeeklyReportData): Promise<Buffer> {
  registerPdfFonts();

  const range = formatWeekRange(data.weekStart, data.weekEnd);
  const net = data.amountReceivedTotal - data.creditsLoggedTotal;

  const doc = React.createElement(
    Document,
    {
      title: `Weekly report — ${data.shopName} — ${range}`,
      author: "Vodium Ledger",
      subject: `Weekly credit and repayment summary for ${data.shopName}`,
      creator: "Vodium Ledger",
      producer: "Vodium Ledger",
    },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      React.createElement(View, { style: styles.goldBar, fixed: true }),

      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.kicker }, "WEEKLY REPORT"),
        React.createElement(Text, { style: styles.shopName }, data.shopName),
        React.createElement(Text, { style: styles.weekLine }, range)
      ),

      React.createElement(
        View,
        { style: styles.body },

        // The two numbers the whole report exists for.
        React.createElement(
          View,
          { style: styles.tileRow },
          tile(
            "Credit you gave out",
            formatNaira(data.creditsLoggedTotal),
            `${data.creditsLoggedCount} credit${data.creditsLoggedCount === 1 ? "" : "s"} logged`,
            WARNING
          ),
          tile(
            "Money you received",
            formatNaira(data.amountReceivedTotal),
            `${data.repaymentCount} repayment${data.repaymentCount === 1 ? "" : "s"}`,
            SUCCESS,
            true
          )
        ),

        React.createElement(
          View,
          { style: styles.tileRow },
          tile(
            "Still owing you",
            formatNaira(data.closingOutstanding),
            "Across your whole book",
            BLACK
          ),
          tile(
            "New customers",
            String(data.newCustomers),
            "First time on your book",
            BLACK,
            true
          )
        ),

        data.topCustomers.length > 0 &&
          React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.sectionTitle }, "Who took the most credit"),
            ...data.topCustomers.map((c, i) =>
              React.createElement(
                View,
                { key: `cust-${i}`, style: styles.row },
                React.createElement(Text, { style: styles.rowName }, c.name),
                React.createElement(Text, { style: styles.rowAmount }, formatNaira(c.amount))
              )
            )
          ),

        React.createElement(
          View,
          { style: styles.summaryBox },
          React.createElement(
            Text,
            { style: styles.summaryLine },
            net >= 0
              ? `Good week — you received ${formatNaira(net)} more than you gave out.`
              : `You gave out ${formatNaira(Math.abs(net))} more than you received this week.`
          ),
          React.createElement(
            Text,
            { style: [styles.summaryLine, { marginTop: 4 }] },
            "Reply LIST on WhatsApp to see everyone owing you right now."
          )
        )
      ),

      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Vodium Ledger · vodiumledger.com · This report covers your own records only."
      )
    )
  );

  return renderToBuffer(doc);
}
