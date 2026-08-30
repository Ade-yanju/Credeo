/** Google Places (New) business discovery for merchant acquisition. */
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

type GoogleAddressComponent = { longText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

function addressComponent(place: GooglePlace, type: string) {
  return place.addressComponents?.find((component) => component.types?.includes(type))?.longText ?? null;
}

function googleError(payload: unknown, status: number) {
  const message = (payload as { error?: { message?: string } })?.error?.message;
  if (status === 403) return "Google Places rejected the request. Check that the Places API (New) is enabled and the API key is valid.";
  if (status === 429) return "Google Places is temporarily rate-limiting searches. Please wait and try again.";
  return message ? `Google Places search failed: ${message}` : `Google Places search failed (HTTP ${status}).`;
}

export async function discoverBusinesses(input: {
  query: string;
  city?: string | null;
  state?: string | null;
  limit: number;
}): Promise<DiscoveredBusiness[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error("Google Places is not configured. Add GOOGLE_MAPS_API_KEY to the server environment.");
  const city = input.city?.trim();
  if (!city) throw new Error("Choose a Nigerian city before searching.");

  const limit = Math.min(Math.max(input.limit, 1), 60);
  const textQuery = `${input.query.trim()} in ${city}${input.state?.trim() ? `, ${input.state.trim()}` : ""}, Nigeria`;
  const fieldMask = [
    "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
    "places.googleMapsUri", "places.internationalPhoneNumber", "places.nationalPhoneNumber", "places.websiteUri",
    "nextPageToken",
  ].join(",");
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3 && places.length < limit; page += 1) {
    const body: Record<string, unknown> = {
      textQuery,
      pageSize: Math.min(20, limit - places.length),
      regionCode: "NG",
      languageCode: "en",
    };
    if (pageToken) body.pageToken = pageToken;
    let response: Response;
    try {
      response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new Error("Google Places took too long to respond. Try a narrower business search.");
      }
      throw new Error("Google Places could not be reached. Please try again shortly.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(googleError(payload, response.status));
    places.push(...((payload as { places?: GooglePlace[] }).places ?? []));
    pageToken = (payload as { nextPageToken?: string }).nextPageToken;
    if (!pageToken) break;
  }

  const seen = new Set<string>();
  return places.flatMap((place) => {
    const businessName = place.displayName?.text?.trim();
    if (!businessName) return [];
    const identity = place.id ?? `${businessName.toLowerCase()}|${place.formattedAddress?.toLowerCase() ?? ""}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const locationText = place.formattedAddress?.trim() || null;
    const website = place.websiteUri ? `Website: ${place.websiteUri}` : null;
    const sourceDetail = [`Google Business Profile`, place.id ? `Place ID: ${place.id}` : null, website, place.googleMapsUri].filter(Boolean).join(" · ").slice(0, 300);
    return [{
      businessName,
      contactName: null,
      phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
      email: null,
      locationText,
      city: addressComponent(place, "locality") ?? addressComponent(place, "postal_town") ?? city,
      state: addressComponent(place, "administrative_area_level_1") ?? input.state?.trim() ?? null,
      sourceDetail,
    }];
  }).slice(0, limit);
}
