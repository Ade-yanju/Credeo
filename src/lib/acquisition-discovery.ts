/** Free Nigeria-only business discovery using OpenStreetMap's public Overpass API. */
export type DiscoveredBusiness = {
  businessName: string;
  contactName: null;
  phone: string | null;
  email: string | null;
  locationText: string | null;
  city: string | null;
  state: string | null;
  sourceDetail: string;
};

type OsmElement = { type: "node" | "way" | "relation"; id: number; tags?: Record<string, string> };

function terms(query: string) {
  const stop = new Set(["and", "the", "near", "with", "for", "in", "at", "of", "to", "business", "businesses", "shops", "shop"]);
  return query.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((term) => !stop.has(term)).slice(0, 5) ?? [];
}
function regex(value: string) { return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"); }
function address(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [street, tags["addr:suburb"], tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ") || null;
}

export async function discoverBusinesses(input: {
  query: string;
  city?: string | null;
  state?: string | null;
  limit: number;
}): Promise<DiscoveredBusiness[]> {
  const keywords = terms(input.query);
  if (!keywords.length) throw new Error("Use a more specific business search, for example ‘provision stores’ or ‘campus laundry’.");
  const pattern = keywords.map(regex).join("|");
  const cities = [input.city, input.state].filter(Boolean).map((value) => regex(value!.trim())).join("|");
  const locality = cities ? `["addr:city"~"${cities}",i]` : "";
  const limit = Math.min(input.limit, 500);
  const data = `[out:json][timeout:45];
area["ISO3166-1"="NG"][admin_level=2]->.nigeria;
(
  nwr(area.nigeria)[name~"${pattern}",i]${locality};
  nwr(area.nigeria)["shop"][name~"${pattern}",i]${locality};
  nwr(area.nigeria)[amenity][name~"${pattern}",i]${locality};
  nwr(area.nigeria)[craft][name~"${pattern}",i]${locality};
);
out tags ${limit};`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VodiumLedger/1.0 merchant-discovery" },
    body: new URLSearchParams({ data }), cache: "no-store", signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    if (response.status === 429 || response.status === 504) throw new Error("The free OpenStreetMap search service is busy. Please wait a minute and try a narrower city or business search.");
    throw new Error(`The OpenStreetMap search service is unavailable (HTTP ${response.status}). Please try again.`);
  }
  const payload = await response.json() as { elements?: OsmElement[]; remark?: string };
  if (payload.remark) throw new Error("The OpenStreetMap search could not complete. Try a narrower city or business search.");
  const seen = new Set<string>();
  return (payload.elements ?? []).flatMap((element) => {
    const tags = element.tags ?? {}; const businessName = tags.name?.trim();
    if (!businessName) return [];
    const phone = tags["contact:phone"] ?? tags.phone ?? null;
    const email = tags["contact:email"] ?? tags.email ?? null;
    const locationText = address(tags);
    const identity = `${businessName.toLowerCase()}|${phone?.replace(/\D/g, "") ?? ""}|${locationText?.toLowerCase() ?? element.id}`;
    if (seen.has(identity)) return []; seen.add(identity);
    return [{ businessName, contactName: null, phone, email, locationText, city: tags["addr:city"] ?? input.city?.trim() ?? null, state: tags["addr:state"] ?? input.state?.trim() ?? null, sourceDetail: `OpenStreetMap Nigeria listing (${element.type}/${element.id})` }];
  }).slice(0, limit);
}
