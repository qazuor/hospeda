/**
 * Google Place ID resolution (H-132).
 *
 * Turning a host-supplied Google Maps URL into a Place ID is the step that
 * silently failed for every real listing in production, so it lives here on its
 * own — separately testable, and impossible to "fix" by accident while editing
 * response mapping.
 *
 * The problem it solves: a Place ID is a `ChIJ…` token, and **no URL Google
 * hands a user today contains one**. The address-bar URL
 * (`/maps/place/Name/@lat,lng,17z/data=…!1s0x95…:0x…`) carries a hexadecimal
 * `ftid`; the *Share* button produces `share.google/AbCdEf`, which carries no
 * identifier at all. A resolver that only scans for `ChIJ` therefore returns
 * `null` on 100% of real input while looking perfectly correct in a test that
 * feeds it a synthetic `ChIJ` URL.
 *
 * @module services/accommodation-external-reputation/adapters/google-place-id.resolver
 */

import { canonicalizeIfShortLink } from '../../../utils/short-link.js';
import type { ReputationFailureCode } from './adapter.types.js';

// ---------------------------------------------------------------------------
// PlaceIdResolution
// ---------------------------------------------------------------------------

/**
 * Outcome of resolving a listing URL to a Google Place ID.
 *
 * Deliberately a discriminated union rather than `string | null`: "this URL
 * contains nothing we can query", "Google says no such place", and "Google was
 * unreachable" are three different situations for the host, and flattening them
 * into one `null` is the same mistake — one layer down — that made the whole
 * integration report success while doing nothing (H-132).
 */
export type PlaceIdResolution =
    | { readonly ok: true; readonly placeId: string }
    | { readonly ok: false; readonly reason: ReputationFailureCode };

// ---------------------------------------------------------------------------
// Places API (New) response types
// ---------------------------------------------------------------------------

/**
 * Error response wrapper from the Places API.
 */
interface PlacesApiErrorResponse {
    readonly error?: {
        readonly message?: string;
        readonly code?: number;
    };
}

/**
 * A `@lat,lng` coordinate pair lifted from a Google Maps URL path.
 */
export interface PlacesLatLng {
    readonly latitude: number;
    readonly longitude: number;
}

/**
 * Minimal shape of a Text Search response when the field mask requests only
 * `places.id`.
 */
interface PlacesTextSearchIdResponse {
    readonly places?: readonly { readonly id?: string }[];
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
 * Abort timeout applied to the Text Search request and to the
 * redirect-following hop that resolves a share link.
 */
const RESOLVE_TIMEOUT_MS = 15_000;

/**
 * Field mask for the Text Search call used ONLY to resolve a Place ID.
 *
 * Deliberately `places.id` and nothing else: Google prices Text Search by the
 * most expensive field requested, and an ID-only mask sits in the cheapest
 * (Essentials / "ID Only") tier. The rating, review count, and review text are
 * then fetched by the adapter's existing Place Details call, so all response
 * mapping keeps flowing through a single path.
 */
const TEXT_SEARCH_ID_FIELD_MASK = 'places.id';

/**
 * Radius, in metres, of the location-bias circle built from a Maps URL's
 * `@lat,lng` token. Tight enough to disambiguate places in a dense block, wide
 * enough to tolerate the drift between a URL's viewport centre and the place
 * itself. Mirrors the import adapter's value.
 */
const TEXT_SEARCH_BIAS_RADIUS_M = 500;

// ---------------------------------------------------------------------------
// Place ID resolution (local — must NOT modify the SPEC-222 import adapter)
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a Google Place ID from an already-canonical Maps URL.
 *
 * Mirrors the extraction logic in the SPEC-222 `google-places.adapter.ts` but
 * lives here independently so the import adapter's field mask is never changed.
 *
 * Extraction strategy (priority order):
 * 1. `place_id` query parameter — `?place_id=ChIJ...`.
 * 2. `ChIJ`-prefixed token anywhere in the URL string.
 *
 * **This function alone is not enough**, and that is the whole of H-132: the
 * canonical URL Google puts in a user's address bar carries a hexadecimal
 * `ftid` (`!1s0x95…:0x…`), not a `ChIJ` token, and the share URL carries no
 * identifier at all. Both return `null` here. See
 * {@link resolvePlaceIdFromUrl} for the full ladder.
 *
 * @param parsed - The parsed external listing URL.
 * @returns The extracted Place ID, or `null` when none is found.
 */
export function extractPlaceIdFromUrl(parsed: URL): string | null {
    // Strategy 1: explicit `place_id` query param
    const fromParam = parsed.searchParams.get('place_id');
    if (fromParam?.startsWith('ChIJ')) {
        return fromParam;
    }

    // Strategy 2: scan the full URL for a ChIJ-prefixed token
    const match = /ChIJ[A-Za-z0-9_-]{10,50}/.exec(parsed.href);
    if (match?.[0]) {
        return match[0];
    }

    return null;
}

/**
 * Extracts the human-readable place name from a Google Maps URL path.
 *
 * Google Maps canonical URLs follow the pattern
 * `/maps/place/<URL-encoded-name>/@lat,lng,...`. The name segment sits between
 * `/maps/place/` and the next `/`, and uses `+` as a space separator in
 * addition to standard percent-encoding.
 *
 * @param parsed - The parsed Google Maps URL.
 * @returns The decoded place name, or `null` when the URL does not match the
 *   `/maps/place/<name>` pattern.
 */
export function extractPlaceNameFromPath(parsed: URL): string | null {
    const match = /\/maps\/place\/([^/]+)/.exec(parsed.pathname);
    if (!match?.[1]) {
        return null;
    }

    let decoded: string;
    try {
        decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
    } catch {
        // Malformed percent-encoding — treat as no usable name.
        return null;
    }
    return decoded.length > 0 ? decoded : null;
}

/**
 * Extracts the `@lat,lng` coordinate pair from a Google Maps URL.
 *
 * The `@` token introduces the viewport immediately after the place name:
 * `/maps/place/Name/@-32.4878131,-58.3626093,732m/...`.
 *
 * @param parsed - The parsed Google Maps URL.
 * @returns A `{ latitude, longitude }` pair, or `null` when no `@` token is present.
 */
export function extractCoordsFromPath(parsed: URL): PlacesLatLng | null {
    const match = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(parsed.pathname);
    if (!match?.[1] || !match[2]) {
        return null;
    }

    const latitude = Number.parseFloat(match[1]);
    const longitude = Number.parseFloat(match[2]);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return null;
    }

    return { latitude, longitude };
}

/**
 * Resolves a Place ID by asking the Places API (New) **Text Search** endpoint
 * for the place named in the URL path, biased to the URL's `@lat,lng` viewport.
 *
 * This is the fallback the import adapter has had since SPEC-222 and this
 * adapter did not — the omission is H-132's root cause. Requests `places.id`
 * only; the aggregates and review text still come from the regular Place
 * Details call afterwards.
 *
 * @param input.name - Human-readable place name from the URL path.
 * @param input.coords - Optional `@lat,lng` coordinates for a location bias circle.
 * @param input.apiKey - Google Places API key.
 * @returns The resolved Place ID, or `null` on no results / any failure.
 */
async function resolvePlaceIdViaTextSearch(input: {
    name: string;
    coords: PlacesLatLng | null;
    apiKey: string;
}): Promise<PlaceIdResolution> {
    const { name, coords, apiKey } = input;

    const body: Record<string, unknown> = { textQuery: name };
    if (coords !== null) {
        body.locationBias = {
            circle: {
                center: { latitude: coords.latitude, longitude: coords.longitude },
                radius: TEXT_SEARCH_BIAS_RADIUS_M
            }
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${PLACES_API_BASE}:searchText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    // Text Search field masks use the `places.` prefix.
                    'X-Goog-FieldMask': TEXT_SEARCH_ID_FIELD_MASK
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            return {
                ok: false,
                reason:
                    response.status === 401 || response.status === 403
                        ? 'credentials_missing'
                        : 'provider_error'
            };
        }

        const json = (await response.json()) as PlacesTextSearchIdResponse | PlacesApiErrorResponse;

        if ('error' in json && json.error) {
            return { ok: false, reason: 'provider_error' };
        }

        const placeId = (json as PlacesTextSearchIdResponse).places?.[0]?.id;
        if (typeof placeId === 'string' && placeId.length > 0) {
            return { ok: true, placeId };
        }

        // Google answered and knows of no such place. This is NOT the same as
        // "we could not build a query" — the host's URL may simply point at a
        // place Google has since removed.
        return { ok: false, reason: 'not_found' };
    } catch (err) {
        // Network error, abort, JSON parse error — degrade, but say which.
        return {
            ok: false,
            reason: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'provider_error'
        };
    }
}

/**
 * Resolves a Google Place ID from a listing URL, trying every strategy a real
 * host-supplied URL might need, in cost order.
 *
 * The ladder, and why each rung exists (all three shapes are present in
 * production data):
 *
 * 1. **Share-link canonicalisation** — `share.google/AbCdEf` carries no
 *    identifier whatsoever. Its redirect is followed (SSRF-checked, via the
 *    shared {@link canonicalizeIfShortLink}) to obtain the canonical URL, and
 *    the remaining strategies run against THAT.
 * 2. **`ChIJ` token** — the cheapest path, no network call. Present when the
 *    URL was produced by an API or carries an explicit `?place_id=`.
 * 3. **Text Search by name + viewport** — the address-bar URL
 *    (`/maps/place/Name/@lat,lng,17z`) carries a hexadecimal `ftid`, never a
 *    `ChIJ` token, so rung 2 always fails on it. One `places:searchText` call
 *    with an ID-only field mask closes the gap.
 *
 * @param input.rawUrl - The listing URL as stored.
 * @param input.apiKey - Google Places API key (needed for rung 3).
 * @returns A {@link PlaceIdResolution} — the Place ID, or why no strategy found one.
 */
export async function resolvePlaceIdFromUrl(input: {
    rawUrl: string;
    apiKey: string;
}): Promise<PlaceIdResolution> {
    const { rawUrl, apiKey } = input;

    // Rung 1: follow a share/short link to its canonical URL (no-op otherwise).
    const canonicalUrl = await canonicalizeIfShortLink({
        rawUrl,
        timeoutMs: RESOLVE_TIMEOUT_MS
    });

    let parsed: URL;
    try {
        parsed = new URL(canonicalUrl);
    } catch {
        return { ok: false, reason: 'unresolvable_url' };
    }

    // Rung 2: a ChIJ token already in the URL — free.
    const fromToken = extractPlaceIdFromUrl(parsed);
    if (fromToken !== null) {
        return { ok: true, placeId: fromToken };
    }

    // Rung 3: resolve by name + viewport via Text Search.
    const placeName = extractPlaceNameFromPath(parsed);
    if (placeName === null) {
        // Nothing in this URL identifies a place: no token, no name. A share
        // link whose redirect could not be followed lands here too.
        return { ok: false, reason: 'unresolvable_url' };
    }

    return resolvePlaceIdViaTextSearch({
        name: placeName,
        coords: extractCoordsFromPath(parsed),
        apiKey
    });
}
