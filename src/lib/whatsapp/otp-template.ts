/**
 * Vodium Ledger — WhatsApp OTP *template* management.
 *
 * Meta only delivers business-initiated messages (like an OTP to a customer
 * who has never chatted with the bot) through a pre-approved template. This
 * module creates and inspects that template via the Graph API using the same
 * credentials the bot already runs on — so the whole setup is one button in
 * the admin console instead of a trip through WhatsApp Manager.
 *
 * The template is an AUTHENTICATION template: Meta fixes its wording, we only
 * choose the name, language and the copy-code button. That's also why creation
 * is safe — there is no copy to get rejected.
 *
 * All calls no-op with a console log in dev (no token), like profile.ts.
 */

const META_API_VERSION = "v19.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

import { resolveConfiguredTemplateName } from "@/lib/otp-delivery";

export interface OtpTemplateInfo {
  name: string;
  status: string;    // APPROVED | PENDING | REJECTED | ...
  language: string;
  category: string;
}

export interface OtpTemplateStatus {
  configured: boolean;        // WhatsApp creds present at all
  resolvedName: string;       // the name OTP sends will actually use
  templates: OtpTemplateInfo[];
  /** The template OTP sending will use, if it exists on the account. */
  active?: OtpTemplateInfo;
  detail?: string;
}

function creds() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    // Optional: skips one Graph round-trip when set.
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  };
}

/**
 * Turn Meta's error responses into instructions a non-Meta-expert can act on.
 * The raw error is always logged server-side for the full picture.
 */
function explainMetaError(status: number, error?: { code?: number; message?: string }): string {
  const code = error?.code;
  if (code === 190) {
    return "The WhatsApp access token is invalid or expired. Generate a new system-user token in Meta Business Settings and update WHATSAPP_ACCESS_TOKEN in Vercel, then redeploy.";
  }
  if (code === 200 || code === 10 || code === 3) {
    return "The access token lacks permission. Regenerate it with BOTH whatsapp_business_messaging and whatsapp_business_management ticked — and make sure the system user has the WhatsApp account added under its Assets (Business Settings → System users → Add assets).";
  }
  if (code === 100) {
    return `Meta rejected the request (#100 ${error?.message ?? "Invalid parameter"}). If the token is new, confirm the system user has the WhatsApp account asset assigned.`;
  }
  return error?.message ?? `Meta returned HTTP ${status}.`;
}

/**
 * The WABA that owns the phone number.
 *
 * The phone-number node does NOT expose the account it belongs to (Meta:
 * "(#100) Tried accessing nonexisting field (whatsapp_business_account)" —
 * learned in production). What DOES work: the token itself declares which
 * WABAs it manages via /debug_token granular scopes. When it manages several,
 * the right one is whichever lists our phone number.
 *
 * WHATSAPP_BUSINESS_ACCOUNT_ID (env) short-circuits all of it.
 */
async function getWabaId(token: string, phoneId: string): Promise<{ id: string } | { error: string }> {
  const preset = creds().wabaId;
  if (preset) return { id: preset };

  const res = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await res.json().catch(() => ({}))) as {
    data?: { granular_scopes?: Array<{ scope?: string; target_ids?: string[] }> };
    error?: { code?: number; message?: string };
  };
  const wabaIds = new Set<string>();
  for (const s of json.data?.granular_scopes ?? []) {
    if (s.scope?.startsWith("whatsapp_business")) {
      for (const id of s.target_ids ?? []) wabaIds.add(id);
    }
  }

  const manualFix =
    " Fastest fix: set WHATSAPP_BUSINESS_ACCOUNT_ID in Vercel — the ID is shown on developers.facebook.com → your app → WhatsApp → API Setup — then redeploy.";

  if (!res.ok) {
    console.error("[otp-template] token inspection failed:", res.status, JSON.stringify(json.error ?? json));
    return { error: explainMetaError(res.status, json.error) + manualFix };
  }

  /** Does this WABA own our sending number? Guards every discovered candidate. */
  async function ownsPhone(id: string): Promise<boolean> {
    const r = await fetch(`${GRAPH}/${id}/phone_numbers?fields=id&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = (await r.json().catch(() => ({}))) as { data?: Array<{ id: string }> };
    return Boolean(j.data?.some((p) => p.id === phoneId));
  }

  if (wabaIds.size === 1) return { id: [...wabaIds][0] };
  if (wabaIds.size > 1) {
    for (const id of wabaIds) if (await ownsPhone(id)) return { id };
    console.error(`[otp-template] none of ${wabaIds.size} scoped WABAs own phone ${phoneId}`);
    return { error: "The token manages several WhatsApp accounts, but none of them own this phone number." + manualFix };
  }

  // No target_ids at all = the token's access is UNRESTRICTED (all assets of
  // the business) — common for admin system users. The scopes carry no asset
  // list then, so walk business → owned WABAs instead. Documented edge:
  // GET /{business-id}/owned_whatsapp_business_accounts.
  const bizRes = await fetch(`${GRAPH}/me/businesses?fields=id&limit=25`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bizJson = (await bizRes.json().catch(() => ({}))) as {
    data?: Array<{ id: string }>;
    error?: { code?: number; message?: string };
  };
  if (bizRes.ok && bizJson.data?.length) {
    for (const biz of bizJson.data) {
      const r = await fetch(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?fields=id&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json().catch(() => ({}))) as { data?: Array<{ id: string }> };
      for (const waba of j.data ?? []) {
        if (await ownsPhone(waba.id)) return { id: waba.id };
      }
      // A business with exactly one WABA needs no phone match to be right.
      if ((j.data?.length ?? 0) === 1 && bizJson.data.length === 1) return { id: j.data![0].id };
    }
  } else {
    console.error("[otp-template] business walk failed:", bizRes.status, JSON.stringify(bizJson.error ?? {}));
  }

  console.error("[otp-template] could not discover the WABA automatically:", JSON.stringify(json.data?.granular_scopes ?? []));
  return {
    error:
      "The token has WhatsApp management access, but the account it belongs to can't be discovered automatically from it." +
      manualFix,
  };
}

/** All message templates on the account (name, status, language, category). */
export async function listOtpTemplates(): Promise<OtpTemplateStatus> {
  const { token, phoneId } = creds();
  const resolvedName = resolveConfiguredTemplateName();

  if (!token || !phoneId) {
    return { configured: false, resolvedName, templates: [], detail: "No WhatsApp credentials configured (dev)." };
  }

  const waba = await getWabaId(token, phoneId);
  if ("error" in waba) {
    return { configured: true, resolvedName, templates: [], detail: waba.error };
  }

  const res = await fetch(
    `${GRAPH}/${waba.id}/message_templates?fields=name,status,language,category&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{ name: string; status: string; language: string; category: string }>;
    error?: { code?: number; message?: string };
  };
  if (!res.ok) {
    console.error("[otp-template] template list failed:", res.status, JSON.stringify(json.error ?? json));
    return { configured: true, resolvedName, templates: [], detail: explainMetaError(res.status, json.error) };
  }

  const templates = (json.data ?? []).map((t) => ({
    name: t.name, status: t.status, language: t.language, category: t.category,
  }));
  const active = templates.find((t) => t.name === resolvedName);
  return { configured: true, resolvedName, templates, active };
}

/**
 * Create the OTP template if it doesn't exist yet. Idempotent: an existing
 * template (any status) is reported, never recreated — so this can never break
 * a working setup. Authentication templates are usually approved in minutes.
 */
export async function ensureOtpTemplate(): Promise<OtpTemplateStatus & { created: boolean }> {
  const current = await listOtpTemplates();
  if (!current.configured || current.detail) return { ...current, created: false };
  if (current.active) return { ...current, created: false };

  const { token, phoneId } = creds();
  const waba = await getWabaId(token!, phoneId!);
  if ("error" in waba) return { ...current, created: false, detail: waba.error };

  const res = await fetch(`${GRAPH}/${waba.id}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: current.resolvedName,
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        // Meta writes the copy for AUTHENTICATION templates; we just opt into
        // the safety line and a 10-minute expiry that matches our OTP TTL.
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 10 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
      ],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string; status?: string;
    error?: { code?: number; message?: string; error_user_msg?: string };
  };
  if (!res.ok) {
    console.error("[otp-template] template create failed:", res.status, JSON.stringify(json.error ?? json));
    // Subcode 2388185: Meta requires completed Business Verification before an
    // account may create AUTHENTICATION templates. No token or ID fixes this —
    // it's a one-time verification of the business itself.
    const needsVerification = (json.error as { error_subcode?: number } | undefined)?.error_subcode === 2388185;
    return {
      ...current, created: false,
      detail: needsVerification
        ? "Meta requires Business Verification before this account may create OTP (authentication) templates. " +
          "Complete it once in Meta Business Settings → Security Center → Start verification (business name, " +
          "address and a registration document — CAC certificate works). Approval usually takes a few days; " +
          "come back and click this button after. Until then, debtors can still receive codes if they message " +
          "the bot first — the panel below the vendor flow already guides this."
        : json.error?.error_user_msg ?? explainMetaError(res.status, json.error),
    };
  }

  const refreshed = await listOtpTemplates();
  return { ...refreshed, created: true };
}

/**
 * Create the payment-reminder UTILITY template if it doesn't exist. This is
 * what lets reminders reach customers with NO open 24-hour session — Meta
 * silently drops free text to them (accepted by the API, never delivered),
 * which production proved the hard way. UTILITY templates need the same
 * Business Verification as authentication ones, so once OTP creation works
 * this does too.
 */
export async function ensureReminderTemplate(input: {
  name: string;
}): Promise<{ name: string; status?: string; created: boolean; detail?: string }> {
  const { token, phoneId } = creds();
  if (!token || !phoneId) {
    return { name: input.name, created: false, detail: "No WhatsApp credentials configured (dev)." };
  }

  const current = await listOtpTemplates();
  if (current.detail && !current.templates.length) {
    return { name: input.name, created: false, detail: current.detail };
  }
  const existing = current.templates.find((t) => t.name === input.name);
  if (existing) return { name: input.name, status: existing.status, created: false };

  const waba = await getWabaId(token, phoneId);
  if ("error" in waba) return { name: input.name, created: false, detail: waba.error };

  const res = await fetch(`${GRAPH}/${waba.id}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      language: "en_US",
      category: "UTILITY",
      components: [
        {
          type: "BODY",
          text:
            "Hi {{1}}, a friendly reminder from {{2}}: {{3}} is outstanding — {{4}}. " +
            "Reply PAID once you have settled, or reply here if anything looks wrong. " +
            "Paying on time builds your Vodium credit score.",
          // Meta requires sample values for every variable at review time.
          example: { body_text: [["Chidi", "Mama Nkechi Stores", "₦2,500", "due tomorrow"]] },
        },
      ],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string; status?: string;
    error?: { code?: number; message?: string; error_user_msg?: string; error_subcode?: number };
  };
  if (!res.ok) {
    console.error("[reminder-template] create failed:", res.status, JSON.stringify(json.error ?? json));
    return {
      name: input.name,
      created: false,
      detail:
        json.error?.error_subcode === 2388185
          ? "Meta requires Business Verification before templates can be created — complete it in Security Center first."
          : json.error?.error_user_msg ?? explainMetaError(res.status, json.error),
    };
  }
  return { name: input.name, status: json.status ?? "PENDING", created: true };
}
