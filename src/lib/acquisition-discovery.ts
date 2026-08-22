/**
 * Public-business discovery for merchant acquisition.
 *
 * This deliberately uses a licensed search API instead of scraping Google Maps
 * HTML. Besides being much less brittle, that means the organisation controls
 * the data source and its terms of use. Only business contact information that
 * the provider returns is stored; we never infer an email address or phone.
 */
export type DiscoveredBusiness = {
  businessName: string;
  contactName: null;
  phone: string | null;
  email: null;
  locationText: string | null;
  city: string | null;
  state: string | null;
  sourceDetail: string;
};

type SerpMapsResult = {
  title?: string;
  phone?: string;
  address?: string;
};

export async function discoverBusinesses(input: {
  query: string;
  city?: string | null;
  state?: string | null;
  limit: number;
}): Promise<DiscoveredBusiness[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("Web discovery is not configured. Add SERPAPI_KEY to the server environment.");

  // SerpApi's Google Maps endpoint is a supported search-data source. The Maps
  // API recommends paging only through start=100; larger offsets become noisy.
  // A 500-item request is therefore intentionally capped at the 100 reliable
  // listings the provider can return for one search.
  const results: DiscoveredBusiness[] = [];
  const seen = new Set<string>();
  const requestedLimit = Math.min(input.limit, 120);
  const pages = Math.ceil(requestedLimit / 20);
  // `gl=ng` localises the Maps result set to Nigeria. Adding the country to
  // the query prevents an ambiguous business/location phrase from drifting to
  // a similarly named place abroad.
  const locality = [input.city?.trim(), input.state?.trim()].filter(Boolean).join(", ");
  const queryWithLocality = locality && !input.query.toLowerCase().includes(locality.toLowerCase())
    ? `${input.query}, ${locality}`
    : input.query;
  const nigeriaQuery = /\bnigeria\b/i.test(queryWithLocality) ? queryWithLocality : `${queryWithLocality}, Nigeria`;
  const payloads = await Promise.all(Array.from({ length: pages }, async (_, page) => {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "search");
    url.searchParams.set("q", nigeriaQuery);
    url.searchParams.set("gl", "ng");
    url.searchParams.set("hl", "en");
    url.searchParams.set("start", String(page * 20));
    url.searchParams.set("api_key", key);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.status === 401 || response.status === 403) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`Nigeria business search was rejected by SerpApi (${response.status}). Check that the production SERPAPI_KEY is a SerpApi private API key with active credits, then redeploy. ${detail || ""}`.trim());
    }
    if (!response.ok) throw new Error(`The business search provider is temporarily unavailable (HTTP ${response.status}). Please try again.`);
    const payload = await response.json() as { local_results?: SerpMapsResult[]; error?: string };
    if (payload.error) throw new Error(payload.error);
    return payload.local_results ?? [];
  }));
  for (const rows of payloads) {
    for (const row of rows) {
      const businessName = row.title?.trim();
      if (!businessName) continue;
      const identity = `${businessName.toLowerCase()}|${(row.phone ?? "").replace(/\D/g, "")}|${(row.address ?? "").toLowerCase()}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      results.push({
        businessName,
        contactName: null,
        phone: row.phone?.trim() || null,
        email: null,
        locationText: row.address?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        sourceDetail: `SerpApi Google Maps Nigeria search: ${nigeriaQuery}`,
      });
      if (results.length === input.limit) return results;
    }
  }
  return results;
}
