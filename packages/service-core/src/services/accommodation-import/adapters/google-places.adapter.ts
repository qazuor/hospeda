/**
 * Google Places Adapter (SPEC-222 T-018)
 *
 * Implements {@link ImportSourceAdapter} using the Google Places API (New)
 * Place Details endpoint to extract accommodation metadata from Google Maps
 * URLs.
 *
 * **Field mask policy**: The API request intentionally omits `reviews`,
 * `rating`, and `userRatingCount` from the `X-Goog-FieldMask` header.
 * SPEC-222 hard rule: reviews and ratings must never be imported from
 * external platforms to prevent scraped sentiment from polluting the
 * Hospeda review system. By omitting those fields from the mask we never
 * even fetch them from Google's servers.
 *
 * **Short-link limitation (MVP)**: URLs on `maps.app.goo.gl`, `goo.gl/maps`,
 * and `g.page` are redirect short-links. Following HTTP redirects to extract
 * a Place ID is out of MVP scope (it requires an additional fetch and may
 * hit rate limits). For MVP these URLs degrade gracefully to an empty
 * extraction. A future task can add short-link resolution via a HEAD request.
 *
 * @module services/accommodation-import/adapters/google-places
 */

import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';

// ---------------------------------------------------------------------------
// Places API (New) response shape
// ---------------------------------------------------------------------------

/**
 * A single address component returned by the Places API.
 */
interface PlacesAddressComponent {
    readonly longText: string;
    readonly shortText: string;
    readonly types: readonly string[];
    readonly languageCode?: string;
}

/**
 * Latitude/longitude pair returned by the Places API.
 */
interface PlacesLatLng {
    readonly latitude: number;
    readonly longitude: number;
}

/**
 * Display name object (localised text + language code).
 */
interface PlacesDisplayName {
    readonly text: string;
    readonly languageCode?: string;
}

/**
 * Subset of the Places API (New) Place Details response that this adapter
 * reads. Only the fields requested via `X-Goog-FieldMask` will be present.
 *
 * **Hard rule**: `rating`, `userRatingCount`, and `reviews` are NEVER
 * included here — they are excluded from the field mask and must not be
 * added in the future (SPEC-222).
 */
interface PlacesApiResponse {
    readonly displayName?: PlacesDisplayName;
    readonly formattedAddress?: string;
    readonly location?: PlacesLatLng;
    readonly nationalPhoneNumber?: string;
    readonly internationalPhoneNumber?: string;
    readonly websiteUri?: string;
    readonly types?: readonly string[];
    readonly addressComponents?: readonly PlacesAddressComponent[];
}

/**
 * API error response shape (non-2xx).
 */
interface PlacesApiErrorResponse {
    readonly error?: {
        readonly message?: string;
        readonly code?: number;
    };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Places API (New) base URL.
 * Fixed trusted host — exempt from `safeExternalFetch` per AC-10.2.
 */
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

/**
 * Fields to request from the Places API.
 *
 * CRITICAL: `reviews`, `rating`, and `userRatingCount` are intentionally
 * absent from this mask. SPEC-222 forbids importing guest reviews or star
 * ratings from external platforms. By omitting them from the mask we never
 * fetch them, ensuring no accidental leak into RawExtraction.
 */
const PLACES_FIELD_MASK =
    'displayName,formattedAddress,location,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,addressComponents';

// ---------------------------------------------------------------------------
// Place ID extraction helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a URL is a known short-link host that requires HTTP redirect
 * resolution to obtain a Place ID.
 *
 * Short-link resolution (HEAD request to follow redirects) is out of MVP
 * scope. These URLs degrade gracefully to an empty extraction.
 *
 * @param url - The parsed Google Maps URL.
 * @returns `true` when the URL is a short-link that cannot be resolved without
 *   following redirects.
 */
function isShortLink(url: URL): boolean {
    const { hostname } = url;
    return (
        hostname === 'maps.app.goo.gl' ||
        hostname === 'g.page' ||
        (hostname === 'goo.gl' && url.pathname.startsWith('/maps'))
    );
}

/**
 * Attempts to extract a Google Place ID from a Maps URL.
 *
 * Extraction strategy (in priority order):
 *
 * 1. `place_id` query parameter — the most explicit form, e.g.
 *    `?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4`.
 * 2. A `ChIJ`-prefixed token anywhere in the URL path or query string —
 *    Google Place IDs always start with `ChIJ` in the current encoding.
 *    This covers the common `/maps/place/Name/@lat,lng,zoom/data=...!1sChIJ...`
 *    URL pattern.
 *
 * Returns `null` when no Place ID can be extracted without following a
 * redirect (e.g. short-links) or when the URL format is unrecognised.
 *
 * @param url - The parsed Google Maps URL.
 * @returns The extracted Place ID string, or `null`.
 */
function extractPlaceId(url: URL): string | null {
    // Strategy 1: explicit `place_id` query param
    const fromParam = url.searchParams.get('place_id');
    if (fromParam?.startsWith('ChIJ')) {
        return fromParam;
    }

    // Strategy 2: scan the full URL string for a ChIJ-prefixed token.
    // Place IDs match /ChIJ[A-Za-z0-9_-]{10,50}/ in the current encoding.
    const match = /ChIJ[A-Za-z0-9_\-]{10,50}/.exec(url.href);
    if (match) {
        return match[0];
    }

    return null;
}

// ---------------------------------------------------------------------------
// Address parsing helpers
// ---------------------------------------------------------------------------

/**
 * Finds the `longText` value of the first address component that has one of
 * the given Google address component types.
 *
 * @param components - Address components from the Places API response.
 * @param types - One or more component type strings to search for.
 * @returns The matching `longText` value, or `undefined`.
 */
function findAddressComponent(
    components: readonly PlacesAddressComponent[],
    ...types: readonly string[]
): string | undefined {
    for (const component of components) {
        for (const type of types) {
            if (component.types.includes(type)) {
                return component.longText;
            }
        }
    }
    return undefined;
}

/**
 * Extracts a locality string (city / sub-locality) from address components.
 * Falls back to the full `formattedAddress` if no locality component exists.
 *
 * @param components - Address components array (may be empty).
 * @param formattedAddress - Full formatted address as fallback.
 * @returns A locality string suitable for destination resolution.
 */
function extractLocality(
    components: readonly PlacesAddressComponent[],
    formattedAddress: string
): string {
    const locality = findAddressComponent(
        components,
        'locality',
        'sublocality',
        'administrative_area_level_2'
    );
    return locality ?? formattedAddress;
}

// ---------------------------------------------------------------------------
// GooglePlacesAdapter
// ---------------------------------------------------------------------------

/**
 * Import adapter for Google Maps / Google Places URLs.
 *
 * Uses the Google Places API (New) Place Details endpoint to fetch structured
 * accommodation metadata. Degrades gracefully when the API key is absent,
 * when the URL is a short-link without an extractable Place ID, or when the
 * API returns a non-2xx response.
 *
 * @example
 * ```ts
 * const adapter = new GooglePlacesAdapter();
 * if (adapter.supports(new URL('https://www.google.com/maps/place/...'))) {
 *   const raw = await adapter.extract(url, ctx);
 * }
 * ```
 */
export class GooglePlacesAdapter implements ImportSourceAdapter {
    /**
     * The platform identifier this adapter handles.
     * Must match `ImportSource` enum value `'google'`.
     */
    readonly source = 'google' as const;

    /**
     * Returns `true` for any URL that represents a Google Maps location.
     *
     * Recognised patterns:
     * - `https://www.google.com/maps/...` (and any google.* TLD with `/maps`)
     * - `https://maps.google.com/...` (and regional variants like maps.google.com.ar)
     * - `https://goo.gl/maps/...` (legacy short-link)
     * - `https://maps.app.goo.gl/...` (modern short-link)
     * - `https://g.page/...` (Google Business Profile short-link)
     *
     * @param url - The parsed URL to test.
     * @returns `true` if this adapter handles the URL.
     */
    supports(url: URL): boolean {
        const { hostname, pathname } = url;
        const lower = hostname.toLowerCase();

        // maps.google.* (e.g. maps.google.com, maps.google.com.ar)
        if (lower.startsWith('maps.google.')) {
            return true;
        }

        // google.*/maps  (e.g. www.google.com/maps, google.com.ar/maps)
        if (lower.includes('google.') && pathname.includes('/maps')) {
            return true;
        }

        // goo.gl/maps short-link
        if (lower === 'goo.gl' && pathname.startsWith('/maps')) {
            return true;
        }

        // maps.app.goo.gl modern short-link
        if (lower === 'maps.app.goo.gl') {
            return true;
        }

        // g.page Google Business Profile short-link
        if (lower === 'g.page') {
            return true;
        }

        return false;
    }

    /**
     * Extracts accommodation field candidates from a Google Maps URL using
     * the Places API (New) Place Details endpoint.
     *
     * **Degradation contract (US-11)**:
     * - Missing / empty `googlePlacesApiKey` → return `{ sourcePlatform: 'google' }` immediately.
     * - Short-link URL with no extractable Place ID → return `{ sourcePlatform: 'google' }`.
     * - Non-2xx API response → return `{ sourcePlatform: 'google' }`.
     * - Any unexpected error inside the fetch path → return `{ sourcePlatform: 'google' }`.
     *
     * Never throws. The caller (import orchestrator) treats a missing-data
     * extraction as a valid empty result, not an error.
     *
     * @param url - The parsed Google Maps URL.
     * @param ctx - Per-request context including credentials and timeout.
     * @returns A loose bag of raw candidate field values, or a minimal
     *   `{ sourcePlatform: 'google' }` on degradation.
     */
    async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
        // -------------------------------------------------------------------
        // US-11: Credential degradation — no API key → empty extraction
        // -------------------------------------------------------------------
        const apiKey = ctx.credentials.googlePlacesApiKey;
        if (!apiKey) {
            return { sourcePlatform: this.source };
        }

        // -------------------------------------------------------------------
        // Short-link check: maps.app.goo.gl / goo.gl/maps / g.page cannot
        // have their Place ID resolved without following an HTTP redirect.
        // MVP scope: degrade gracefully. Future task: add short-link resolution.
        // -------------------------------------------------------------------
        if (isShortLink(url)) {
            return { sourcePlatform: this.source };
        }

        // -------------------------------------------------------------------
        // Place ID extraction
        // -------------------------------------------------------------------
        const placeId = extractPlaceId(url);
        if (!placeId) {
            // Cannot identify the place from the URL structure — degrade.
            return { sourcePlatform: this.source };
        }

        // -------------------------------------------------------------------
        // Places API (New) Place Details call
        // -------------------------------------------------------------------
        let apiResponse: PlacesApiResponse;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ctx.timeoutMs);

            let response: Response;
            try {
                response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
                    method: 'GET',
                    headers: {
                        'X-Goog-Api-Key': apiKey,
                        // Field mask intentionally excludes reviews/rating/userRatingCount.
                        // SPEC-222 hard rule: never fetch or import guest ratings/reviews.
                        'X-Goog-FieldMask': PLACES_FIELD_MASK
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (!response.ok) {
                // Non-2xx — degrade, do not throw
                return { sourcePlatform: this.source };
            }

            const json = (await response.json()) as PlacesApiResponse | PlacesApiErrorResponse;

            // If the response contains an error object, treat it as a failure
            if ('error' in json && json.error) {
                return { sourcePlatform: this.source };
            }

            apiResponse = json as PlacesApiResponse;
        } catch {
            // Network error, timeout, JSON parse error — degrade, do not throw
            return { sourcePlatform: this.source };
        }

        // -------------------------------------------------------------------
        // Map API response → RawExtraction
        // All fields tagged source: 'official_api'
        // -------------------------------------------------------------------
        return buildRawExtraction(apiResponse);
    }
}

// ---------------------------------------------------------------------------
// buildRawExtraction (pure mapping — no network I/O, no throws)
// ---------------------------------------------------------------------------

/**
 * Maps a Places API (New) Place Details response to a {@link RawExtraction}.
 *
 * All candidate fields are tagged `source: 'official_api'` because the data
 * originates from Google's official structured API, not from HTML scraping.
 *
 * **Hard rule**: `rating`, `userRatingCount`, and `reviews` fields are NEVER
 * read from the response here, even if they were somehow present. SPEC-222.
 *
 * @param place - The raw Places API response object.
 * @returns A RawExtraction bag with every field the API provided.
 */
function buildRawExtraction(place: PlacesApiResponse): RawExtraction {
    const components = place.addressComponents ?? [];

    // Locality for destination resolution
    const scrapedLocality = place.formattedAddress
        ? extractLocality(components, place.formattedAddress)
        : undefined;

    // Country from address components
    const scrapedCountry = findAddressComponent(components, 'country');

    // Best-effort street / number from address components
    const streetName = findAddressComponent(components, 'route');
    const streetNumber = findAddressComponent(components, 'street_number');

    // Build the location sub-object only when we have at least coordinates
    const locationEntries = buildLocationEntries(place, streetName, streetNumber);

    // Contact info — prefer international phone when available
    const phone = place.internationalPhoneNumber ?? place.nationalPhoneNumber;

    const result: RawExtraction = {
        sourcePlatform: 'google',

        ...(place.displayName?.text
            ? { name: { value: place.displayName.text, source: 'official_api' } }
            : {}),

        ...(locationEntries ? { location: locationEntries } : {}),

        ...(phone || place.websiteUri
            ? {
                  contactInfo: {
                      ...(phone ? { mobilePhone: { value: phone, source: 'official_api' } } : {}),
                      ...(place.websiteUri
                          ? { website: { value: place.websiteUri, source: 'official_api' } }
                          : {})
                  }
              }
            : {}),

        ...(scrapedLocality ? { scrapedLocality } : {}),
        ...(scrapedCountry ? { scrapedCountry } : {})
    };

    return result;
}

/**
 * Builds the `location` sub-object for a {@link RawExtraction} from Places
 * API coordinates and address components.
 *
 * Returns `undefined` when neither coordinates nor street data are available.
 *
 * @param place - The Places API response.
 * @param streetName - Street name extracted from address components, if any.
 * @param streetNumber - Street number extracted from address components, if any.
 * @returns The location candidates object, or `undefined`.
 */
function buildLocationEntries(
    place: PlacesApiResponse,
    streetName: string | undefined,
    streetNumber: string | undefined
):
    | {
          readonly coordinates?: { readonly value: unknown; readonly source: 'official_api' };
          readonly street?: { readonly value: unknown; readonly source: 'official_api' };
          readonly number?: { readonly value: unknown; readonly source: 'official_api' };
      }
    | undefined {
    const hasCoordinates = place.location !== undefined;
    const hasStreet = streetName !== undefined;

    if (!hasCoordinates && !hasStreet) {
        return undefined;
    }

    return {
        ...(hasCoordinates && place.location
            ? {
                  coordinates: {
                      value: {
                          lat: String(place.location.latitude),
                          long: String(place.location.longitude)
                      },
                      source: 'official_api' as const
                  }
              }
            : {}),
        ...(hasStreet && streetName
            ? { street: { value: streetName, source: 'official_api' as const } }
            : {}),
        ...(streetNumber
            ? { number: { value: streetNumber, source: 'official_api' as const } }
            : {})
    };
}
