/**
 * Vodium Ledger — download inbound WhatsApp media.
 *
 * Meta does not put image bytes in the webhook; it sends a media *id*. Fetching
 * the actual image is a two-step dance:
 *   1. GET /{media-id}        → a short-lived, authenticated download URL
 *   2. GET that URL with the token → the bytes
 *
 * The URL from step 1 expires in about 5 minutes and, unlike most CDN links,
 * still requires the Authorization header on step 2 — omitting it returns 401,
 * which is the usual reason a "download the receipt" integration mysteriously
 * fails in production.
 */

const META_API_VERSION = "v19.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

/** Refuse anything larger than this so a malicious upload can't exhaust memory. */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB — WhatsApp images are far smaller

export interface DownloadedMedia {
  base64: string;
  mimeType: string;
  bytes: number;
}

/**
 * Fetch an inbound media object as base64.
 * Returns null on any failure — callers should treat that as "could not read
 * the image" and reply asking the customer to resend, never as a crash.
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  creds?: { token: string; phoneId: string },
): Promise<DownloadedMedia | null> {
  const token = creds?.token ?? process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.log(`[media] no WhatsApp token configured; cannot download ${mediaId}`);
    return null;
  }

  try {
    // Step 1 — resolve the media id to a temporary download URL.
    const metaRes = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.warn(`[media] lookup failed for ${mediaId}: ${metaRes.status} ${await metaRes.text()}`);
      return null;
    }
    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!meta.url) {
      console.warn(`[media] no download URL returned for ${mediaId}`);
      return null;
    }
    if (typeof meta.file_size === "number" && meta.file_size > MAX_MEDIA_BYTES) {
      console.warn(`[media] ${mediaId} is ${meta.file_size} bytes — over the ${MAX_MEDIA_BYTES} limit`);
      return null;
    }

    // Step 2 — the CDN URL still needs the bearer token.
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) {
      console.warn(`[media] download failed for ${mediaId}: ${binRes.status}`);
      return null;
    }

    const buffer = Buffer.from(await binRes.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) {
      console.warn(`[media] ${mediaId} exceeded size limit after download (${buffer.byteLength})`);
      return null;
    }

    return {
      base64: buffer.toString("base64"),
      mimeType: meta.mime_type ?? binRes.headers.get("content-type") ?? "application/octet-stream",
      bytes: buffer.byteLength,
    };
  } catch (err) {
    console.warn(`[media] download threw for ${mediaId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
