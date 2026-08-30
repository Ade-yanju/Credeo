/** Extracts explicitly published contact emails from a business website. */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_PAGES = 3;

function websiteFromSource(sourceDetail: string | null) {
  const match = sourceDetail?.match(/Website:\s*(https?:\/\/[^\s·]+)/i);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function cleanEmail(value: string) {
  const email = value.trim().toLowerCase().replace(/[),.;:]+$/, "");
  if (email.includes("example.") || email.endsWith("@sentry.io") || email.endsWith("@wixpress.com")) return null;
  return email;
}

function emailsFromHtml(html: string) {
  const found = new Set<string>();
  const mailtoEmails = (html.match(/mailto:([^?"'\s>]+)/gi) ?? []).map((value) => value.slice(7));
  for (const raw of [...(html.match(EMAIL_RE) ?? []), ...mailtoEmails]) {
    const email = cleanEmail(raw);
    if (email) found.add(email);
  }
  return [...found];
}

function contactLinks(html: string, base: URL) {
  const urls: URL[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (!/(contact|about|support|hello|reach|connect)/i.test(match[1])) continue;
    try {
      const url = new URL(match[1], base);
      if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname === base.hostname) urls.push(url);
    } catch {
      // Ignore malformed and javascript links.
    }
  }
  return [...new Map(urls.map((url) => [url.href, url])).values()].slice(0, MAX_PAGES - 1);
}

async function fetchHtml(url: URL) {
  const response = await fetch(url, {
    headers: { "User-Agent": "VodiumLedger/1.0 public-contact-enrichment" },
    redirect: "follow",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return null;
  return response.text();
}

export async function findPublicEmail(sourceDetail: string | null) {
  const website = websiteFromSource(sourceDetail);
  if (!website) return null;
  const home = await fetchHtml(website).catch(() => null);
  const pages = home ? [website, ...contactLinks(home, website)] : [website];
  for (const page of pages.slice(0, MAX_PAGES)) {
    const html = page === website && home ? home : await fetchHtml(page).catch(() => null);
    const email = html ? emailsFromHtml(html)[0] : null;
    if (email) return email;
  }
  return null;
}
