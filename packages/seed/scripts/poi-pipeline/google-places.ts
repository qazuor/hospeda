/**
 * HOS-141 (enhancement) — Google Places geocoder (cascade fallback).
 *
 * The Nominatim/OSM tier resolves only ~14% of the coordinate-less rows,
 * because most are small named local landmarks absent from OpenStreetMap. This
 * provider searches Google's far richer POI database BY NAME
 * (`places:searchText`, the same API the accommodation-import adapter uses),
 * which is exactly what those rows need.
 *
 * Cost control (the batch is ~618 one-time calls, ~$0.032 each):
 * - A hard {@link GooglePlacesOptions.maxRequests} cap throws before exceeding
 *   it, so a bug can never run up the bill (belt; the Google Cloud Console
 *   quota is the suspenders).
 * - The committed cache means a re-run costs $0.
 * - A province guard (result address must be in Entre Ríos) rejects a
 *   right-name/wrong-province homonym rather than writing a wrong coordinate.
 */
import type { Geocoder, RawGeocodeHit } from './geocoder.js';

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Field mask kept minimal to stay in the cheapest applicable Places (New)
 * SKU: only location + formattedAddress + displayName.
 */
const FIELD_MASK = 'places.location,places.formattedAddress,places.displayName';

/** Confidence importance assigned to a province-guarded Places name match. */
const PLACES_MATCH_IMPORTANCE = 0.9;

/** A single Places Text Search result (subset of the field mask). */
interface PlacesResult {
    readonly location?: { readonly latitude?: number; readonly longitude?: number };
    readonly formattedAddress?: string;
    readonly displayName?: { readonly text?: string };
}

/** Options for {@link createGooglePlacesGeocoder}. */
export interface GooglePlacesOptions {
    /** Google Places API key. */
    readonly apiKey: string;
    /**
     * Hard cap on live requests. Reaching it THROWS — the pipeline stops rather
     * than silently continuing. Required, so a cost cap is never forgotten.
     */
    readonly maxRequests: number;
    /** Min ms between requests. Default 120 (Google tolerates high QPS). */
    readonly minIntervalMs?: number;
    /** Max retries on 429/5xx. Default 2. */
    readonly maxRetries?: number;
    /** Base backoff ms (doubled per retry). Default 500. */
    readonly backoffBaseMs?: number;
    /** Substring the result address must contain (accent/case-insensitive). Default the Entre Rios province. */
    readonly regionGuard?: string;
    /** Injectable fetch (default global `fetch`). */
    readonly fetchFn?: typeof fetch;
    /** Injectable sleep (default real `setTimeout`). */
    readonly sleep?: (ms: number) => Promise<void>;
    /** Injectable clock (default `Date.now`). */
    readonly now?: () => number;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Lowercases and strips diacritics for accent-insensitive matching. */
function normalize(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Maps a raw Places result to a {@link RawGeocodeHit}, applying the province
 * guard. Returns `null` when there is no usable/ in-region result.
 *
 * @param place - The first Places result (or undefined).
 * @param regionGuard - Substring the address must contain (normalized).
 * @returns The hit, or `null`.
 */
export function mapPlacesResult(
    place: PlacesResult | undefined,
    regionGuard: string
): RawGeocodeHit | null {
    const lat = place?.location?.latitude;
    const long = place?.location?.longitude;
    if (typeof lat !== 'number' || typeof long !== 'number') {
        return null;
    }
    const address = place?.formattedAddress ?? '';
    if (!normalize(address).includes(normalize(regionGuard))) {
        return null; // right name, wrong province -> reject (a wrong coord is worse than none)
    }
    return {
        lat,
        long,
        importance: PLACES_MATCH_IMPORTANCE,
        featureClass: 'google-places',
        featureType: '',
        displayName: place?.displayName?.text ?? address,
        provider: 'google-places'
    };
}

/**
 * Creates a rate-limited, cost-capped Google Places name-search geocoder.
 *
 * @param options - See {@link GooglePlacesOptions}.
 * @returns A {@link Geocoder} whose `resolve` takes a name-based query string.
 */
export function createGooglePlacesGeocoder(options: GooglePlacesOptions): Geocoder {
    const {
        apiKey,
        maxRequests,
        minIntervalMs = 120,
        maxRetries = 2,
        backoffBaseMs = 500,
        regionGuard = 'Entre Rios',
        fetchFn = fetch,
        sleep = realSleep,
        now = Date.now
    } = options;

    let requestCount = 0;
    let lastRequestAt = Number.NEGATIVE_INFINITY;

    const enforceRateLimit = async (): Promise<void> => {
        const waitMs = minIntervalMs - (now() - lastRequestAt);
        if (waitMs > 0) {
            await sleep(waitMs);
        }
    };

    const resolve = async (query: string): Promise<RawGeocodeHit | null> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (requestCount >= maxRequests) {
                throw new Error(
                    `Google Places request cap of ${maxRequests} reached — stopping to control cost.`
                );
            }
            await enforceRateLimit();
            lastRequestAt = now();
            requestCount += 1;

            const response = await fetchFn(SEARCH_TEXT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': FIELD_MASK
                },
                body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'AR' })
            });

            if (response.status === 429 || response.status >= 500) {
                if (attempt === maxRetries) {
                    throw new Error(
                        `Google Places gave up after ${maxRetries + 1} attempts (last status ${response.status}).`
                    );
                }
                await sleep(backoffBaseMs * 2 ** attempt);
                continue;
            }

            if (!response.ok) {
                return null;
            }

            const body = (await response.json()) as { places?: PlacesResult[] };
            return mapPlacesResult(body.places?.[0], regionGuard);
        }
        return null;
    };

    return { resolve };
}
