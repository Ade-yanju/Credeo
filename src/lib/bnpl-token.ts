/**
 * Vodium Ledger — signed public tokens for BNPL order links.
 *
 * Lets a customer open their order's consent / receipt page without a login,
 * using an unguessable HMAC-signed token instead of a raw order id. No DB
 * column is needed — the token is `base64url(orderId).HMAC(secret, ...)`.
 */

import crypto from "crypto";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[bnpl-token] SESSION_SECRET is required in production");
    }
    return "dev-only-secret-change-me-before-production";
  }
  return s;
}

function hmac(input: string): string {
  return crypto.createHmac("sha256", getSecret()).update(input, "utf8").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signOrderToken(orderId: string): string {
  const payload = Buffer.from(orderId, "utf8").toString("base64url");
  return `${payload}.${hmac(`v1:bnpl:${payload}`)}`;
}

export function verifyOrderToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    if (!safeEqual(incoming, hmac(`v1:bnpl:${payload}`))) return null;
    const orderId = Buffer.from(payload, "base64url").toString("utf8");
    return orderId.length >= 10 ? orderId : null;
  } catch {
    return null;
  }
}

/**
 * Signed public link for an ambassador's own stats page (same scheme, separate
 * namespace). Lets a campus rep bookmark their numbers without an account.
 */
export function signAmbassadorToken(ambassadorId: string): string {
  const payload = Buffer.from(ambassadorId, "utf8").toString("base64url");
  return `${payload}.${hmac(`v1:ambassador:${payload}`)}`;
}

export function verifyAmbassadorToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    if (!safeEqual(incoming, hmac(`v1:ambassador:${payload}`))) return null;
    const id = Buffer.from(payload, "base64url").toString("utf8");
    return id.length >= 10 ? id : null;
  } catch {
    return null;
  }
}

/** Signed public link for a digital invoice (same scheme, separate namespace). */
export function signInvoiceToken(invoiceId: string): string {
  const payload = Buffer.from(invoiceId, "utf8").toString("base64url");
  return `${payload}.${hmac(`v1:invoice:${payload}`)}`;
}

export function verifyInvoiceToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    if (!safeEqual(incoming, hmac(`v1:invoice:${payload}`))) return null;
    const invoiceId = Buffer.from(payload, "base64url").toString("utf8");
    return invoiceId.length >= 10 ? invoiceId : null;
  } catch {
    return null;
  }
}

/**
 * Signed public link for a vendor's weekly PDF report.
 *
 * Unlike the tokens above this carries TWO values — the vendor and the week —
 * because a report is not a stored row: it is rendered on demand from whatever
 * the ledger says for that week. The pair is joined by "|", a character cuid()
 * never produces, so the split is unambiguous.
 *
 * This link must be publicly fetchable because Meta's servers download the
 * document when we send it as a WhatsApp template header — the vendor's own
 * session is not involved.
 */
export function signReportToken(vendorId: string, weekStart: Date): string {
  const raw = `${vendorId}|${weekStart.toISOString().slice(0, 10)}`;
  const payload = Buffer.from(raw, "utf8").toString("base64url");
  return `${payload}.${hmac(`v1:report:${payload}`)}`;
}

export function verifyReportToken(token: string): { vendorId: string; weekStart: Date } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const incoming = token.slice(dot + 1);
    if (!safeEqual(incoming, hmac(`v1:report:${payload}`))) return null;

    const [vendorId, day] = Buffer.from(payload, "base64url").toString("utf8").split("|");
    if (!vendorId || vendorId.length < 10 || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

    const weekStart = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(weekStart.getTime())) return null;

    return { vendorId, weekStart };
  } catch {
    return null;
  }
}
