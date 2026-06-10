/**
 * Thin wrapper around the OpenStreetMap Nominatim public endpoints.
 *
 * Usage policy: max 1 req/sec, bulk geocoding is forbidden, a meaningful
 * `User-Agent` should identify the app. We are well under the policy in
 * admin (a host edits one accommodation at a time and presses a button
 * explicitly), but if traffic ever spikes the consumer should swap this
 * out for a hosted Nominatim alternative (LocationIQ, MapTiler) without
 * touching the field UI.
 *
 * See https://operations.osmfoundation.org/policies/nominatim/
 */

export interface NominatimForwardResult {
    readonly lat: number;
    readonly lng: number;
    readonly displayName: string;
    /**
     * House number Nominatim actually matched, if any.
     * `undefined` means OSM has no number on that road near the search and
     * the returned point is a best-effort fallback on the street centreline.
     */
    readonly matchedHouseNumber?: string;
    /** Street name Nominatim matched (best-effort). */
    readonly matchedStreet?: string;
}

export interface NominatimReverseResult {
    /** Street name (`road` / `pedestrian` from the address details). */
    readonly street?: string;
    /** House number (`house_number`). */
    readonly number?: string;
    /** Best-effort city name (`city` / `town` / `village`). */
    readonly city?: string;
    /** Human-readable full address as Nominatim returned it. */
    readonly displayName: string;
}

/**
 * Inputs for the forward geocoder. Prefer the structured fields
 * (`street`, `number`, `city`, `state`, `country`) over the free-form `query`
 * — structured search disambiguates much better. For example
 * `q=San Lorenzo 14, Concepción del Uruguay` happily matches a street called
 * "Concepción del Uruguay" in Cipolletti, while
 * `street=San Lorenzo 14&city=Concepción del Uruguay&country=Argentina`
 * pins the city correctly.
 */
export interface GeocodeForwardParams {
    readonly street?: string;
    readonly number?: string;
    readonly city?: string;
    readonly state?: string;
    readonly country?: string;
    /** Free-text fallback when none of the structured fields are available. */
    readonly query?: string;
    /** Two-letter country codes (lowercase) to scope the search. */
    readonly countryCodes?: readonly string[];
    readonly signal?: AbortSignal;
}

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const COMMON_HEADERS: HeadersInit = {
    'Accept-Language': 'es,en;q=0.7'
};

interface RawNominatimAddress {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
}

/**
 * Forward geocode → `{ lat, lng, displayName }` (first match).
 *
 * @returns `null` when Nominatim returns no results.
 * @throws when the HTTP call fails or the body is not the expected shape.
 */
export async function geocodeForward(
    params: GeocodeForwardParams
): Promise<NominatimForwardResult | null> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    if (params.countryCodes?.length) {
        url.searchParams.set('countrycodes', params.countryCodes.join(','));
    }

    const hasStructured = Boolean(params.street || params.city || params.state || params.country);
    if (hasStructured) {
        if (params.street) {
            // Nominatim convention: "<housenumber> <streetname>", which also
            // tolerates "<streetname> <number>". Combine when both available.
            const streetParam = params.number
                ? `${params.street} ${params.number}`.trim()
                : params.street;
            url.searchParams.set('street', streetParam);
        }
        if (params.city) url.searchParams.set('city', params.city);
        if (params.state) url.searchParams.set('state', params.state);
        if (params.country) url.searchParams.set('country', params.country);
    } else if (params.query) {
        url.searchParams.set('q', params.query);
    } else {
        return null;
    }

    const res = await fetch(url.toString(), {
        signal: params.signal,
        headers: COMMON_HEADERS
    });
    if (!res.ok) throw new Error(`Nominatim search HTTP ${res.status}`);

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0] as {
        lat?: string;
        lon?: string;
        display_name?: string;
        address?: RawNominatimAddress;
    };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
        lat,
        lng,
        displayName: first.display_name ?? '',
        matchedHouseNumber: first.address?.house_number,
        matchedStreet: first.address?.road ?? first.address?.pedestrian
    };
}

/**
 * Reverse geocode: `{ lat, lng }` → structured address details.
 *
 * @returns `null` when no result.
 * @throws when the HTTP call fails or the body is not the expected shape.
 */
export async function geocodeReverse(
    lat: number,
    lng: number,
    options?: { signal?: AbortSignal }
): Promise<NominatimReverseResult | null> {
    const url = new URL(REVERSE_URL);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url.toString(), {
        signal: options?.signal,
        headers: COMMON_HEADERS
    });
    if (!res.ok) throw new Error(`Nominatim reverse HTTP ${res.status}`);

    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null) return null;
    const payload = data as { address?: RawNominatimAddress; display_name?: string };
    const address = payload.address;
    if (!address) return null;

    return {
        street: address.road ?? address.pedestrian ?? undefined,
        number: address.house_number ?? undefined,
        city: address.city ?? address.town ?? address.village ?? undefined,
        displayName: payload.display_name ?? ''
    };
}
