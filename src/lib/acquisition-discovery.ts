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
type GeocodeResult = { boundingbox?: [string, string, string, string] };

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
  const city = input.city?.trim();
  if (!city) throw new Error("Choose a Nigerian city before searching. This keeps the free public search fast and reliable.");
  const geocodeUrl = new URL("https://nominatim.openstreetmap.org/search");
  geocodeUrl.searchParams.set("format", "jsonv2"); geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("q", `${city}${input.state ? `, ${input.state}` : ""}, Nigeria`);
  let geocode: Response;
  try {
    geocode = await fetch(geocodeUrl, { headers: { "User-Agent": "VodiumLedger/1.0 merchant-discovery" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new Error("The free map service took too long to locate that city. Please try again shortly.");
    throw new Error("The free map service could not locate that city. Please try again shortly.");
  }
  const locations = geocode.ok ? await geocode.json() as GeocodeResult[] : [];
  const bounds = locations[0]?.boundingbox;
  if (!bounds) throw new Error("That Nigerian city could not be located. Check the spelling and try again.");
  const [south, north, west, east] = bounds;
  const bbox = `(${south},${west},${north},${east})`;
  const limit = Math.min(input.limit, 500);
  const data = `[out:json][timeout:20];
(
  nwr${bbox}[name~"${pattern}",i];
  nwr${bbox}["shop"][name~"${pattern}",i];
  nwr${bbox}[amenity][name~"${pattern}",i];
  nwr${bbox}[craft][name~"${pattern}",i];
);
out tags ${limit};`;
  let response: Response;
  try {
    response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "VodiumLedger/1.0 merchant-discovery" },
      body: new URLSearchParams({ data }), cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new Error("The free map search took too long. Try 50 listings or a more specific business category.");
    throw new Error("The free map search could not be reached. Please try again shortly.");
  }
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
