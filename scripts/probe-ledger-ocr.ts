/**
 * Manual probe: run the real ledger OCR against a synthetic handwritten page.
 * Not part of the automated suite — it costs an API call and needs a live key.
 *   node --import tsx scripts/probe-ledger-ocr.ts /tmp/ledger-page.png
 */
import { readFileSync } from "node:fs";
import { extractLedgerPage } from "../src/lib/ocr";

const path = process.argv[2] ?? "/tmp/ledger-page.png";

async function main() {
  const base64 = readFileSync(path).toString("base64");
  const result = await extractLedgerPage({ imageBase64: base64, mediaType: "image/png" });

  if (result === null) {
    console.log("RESULT: null (OCR disabled or the call failed — see the [ocr] warning above)");
    return;
  }
  console.log("RESULT:", JSON.stringify(result, null, 2));
  const total = result.entries.reduce((s, e) => s + e.amountOwed, 0);
  console.log(`rows=${result.entries.length} unreadable=${result.unreadableRows} total=${total}`);
}

void main();
