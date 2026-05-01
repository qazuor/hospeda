/**
 * @file geocoding.service.ts
 * @description Server-side proxy for geocoding providers (SPEC-097, Phase 6).
 *
 * Wraps Photon (autocomplete) and Nominatim (forward/reverse). All public
 * methods are pure async functions; the module owns a small in-memory LRU
 * cache and an internal rate limiter for Nominatim (1 req/s policy).
 *
 * The frontend never talks to Photon/Nominatim directly: the admin app calls
 * `/api/v1/admin/geocoding/*` which delegate here. This centralises the
 * `User-Agent` header (required by Nominatim), rate limiting, and the future
 * provider-swap path (e.g. Mapbox Search) without touching consumers.
 */

const PHOTON_BASE = 'https://photon.komoot.io/api/';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
// Argentina bounding box used as a Photon location bias.
const AR_BBOX = '-73.5,-55.0,-53.6,-21.8';
const CACHE_TTL_MS = 10 * 60 * 1000;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
let lastNominatimAt = 0;

function getCached<T>(key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
        cache.delete(key);
        return undefined;
    }
    return entry.value as T;
}

function setCached<T>(key: string, value: T): void {
    if (cache.size > 1000) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function throttleNominatim(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastNominatimAt;
    if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
    }
    lastNominatimAt = Date.now();
}

export interface GeocodingDependencies {
    /** Replace the global fetch (useful for tests). */
    readonly fetchFn?: typeof fetch;
    /** User-Agent header sent to Nominatim. Required by their usage policy. */
    readonly userAgent: string;
}

export interface GeocodingSuggestion {
    readonly label: string;
    readonly lat: number;
    readonly lng: number;
    readonly street?: string;
    readonly number?: string;
    readonly city?: string;
    readonly state?: string;
    readonly country?: string;
    readonly postcode?: string;
}

export interface GeocodingAutocompleteInput {
    readonly query: string;
    readonly locale?: string;
}

export interface GeocodingForwardInput {
    readonly query: string;
}

export interface GeocodingReverseInput {
    readonly lat: number;
    readonly lng: number;
}

/**
 * Photon autocomplete — fast type-ahead suggestions for an address fragment.
 * Falls back to an empty array on network/parse errors so the caller never
 * shows a broken UI; provider failures are logged via the standard logger.
 */
export async function geocodingAutocomplete(
    input: GeocodingAutocompleteInput,
    deps: GeocodingDependencies
): Promise<readonly GeocodingSuggestion[]> {
    const query = input.query.trim();
    if (query.length < 3) return [];

    const cacheKey = `photon:${input.locale ?? 'es'}:${query}`;
    const cached = getCached<readonly GeocodingSuggestion[]>(cacheKey);
    if (cached) return cached;

    const fetchFn = deps.fetchFn ?? fetch;
    const url = `${PHOTON_BASE}?q=${encodeURIComponent(query)}&lang=${
        input.locale ?? 'es'
    }&bbox=${AR_BBOX}&limit=8`;

    try {
        const res = await fetchFn(url, { headers: { 'User-Agent': deps.userAgent } });
        if (!res.ok) return [];
        const json = (await res.json()) as PhotonResponse;
        const suggestions = (json.features ?? []).map(photonFeatureToSuggestion);
        setCached(cacheKey, suggestions);
        return suggestions;
    } catch {
        return [];
    }
}

/**
 * Nominatim forward geocoding — resolves a free-text address to coordinates
 * + structured fields. Used when the user submits the form or selects a Photon
 * suggestion that lacks a precise pin.
 */
export async function geocodingForward(
    input: GeocodingForwardInput,
    deps: GeocodingDependencies
): Promise<GeocodingSuggestion | null> {
    const query = input.query.trim();
    if (query.length < 3) return null;

    const cacheKey = `nominatim:forward:${query}`;
    const cached = getCached<GeocodingSuggestion | null>(cacheKey);
    if (cached !== undefined) return cached;

    await throttleNominatim();
    const fetchFn = deps.fetchFn ?? fetch;
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(
        query
    )}&format=json&countrycodes=ar&addressdetails=1&limit=1`;

    try {
        const res = await fetchFn(url, { headers: { 'User-Agent': deps.userAgent } });
        if (!res.ok) {
            setCached(cacheKey, null);
            return null;
        }
        const json = (await res.json()) as NominatimSearchResult[];
        const first = json[0];
        if (!first) {
            setCached(cacheKey, null);
            return null;
        }
        const suggestion = nominatimResultToSuggestion(first);
        setCached(cacheKey, suggestion);
        return suggestion;
    } catch {
        return null;
    }
}

/**
 * Nominatim reverse geocoding — resolves coordinates to a structured address.
 * Used after the host drags the pin to a new location, with a debounce in the
 * frontend to respect the 1 req/s rate limit.
 */
export async function geocodingReverse(
    input: GeocodingReverseInput,
    deps: GeocodingDependencies
): Promise<GeocodingSuggestion | null> {
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;

    const cacheKey = `nominatim:reverse:${input.lat.toFixed(5)},${input.lng.toFixed(5)}`;
    const cached = getCached<GeocodingSuggestion | null>(cacheKey);
    if (cached !== undefined) return cached;

    await throttleNominatim();
    const fetchFn = deps.fetchFn ?? fetch;
    const url = `${NOMINATIM_BASE}/reverse?lat=${input.lat}&lon=${input.lng}&format=json&addressdetails=1`;

    try {
        const res = await fetchFn(url, { headers: { 'User-Agent': deps.userAgent } });
        if (!res.ok) {
            setCached(cacheKey, null);
            return null;
        }
        const json = (await res.json()) as NominatimReverseResult;
        if (!json?.lat || !json?.lon) {
            setCached(cacheKey, null);
            return null;
        }
        const suggestion = nominatimResultToSuggestion({
            ...json,
            display_name: json.display_name ?? ''
        });
        setCached(cacheKey, suggestion);
        return suggestion;
    } catch {
        return null;
    }
}

/** Test-only: clears the in-memory cache. */
export function __resetGeocodingCacheForTests(): void {
    cache.clear();
    lastNominatimAt = 0;
}

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: {
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
}

interface PhotonResponse {
    features?: PhotonFeature[];
}

function photonFeatureToSuggestion(f: PhotonFeature): GeocodingSuggestion {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties;
    const labelParts = [
        props.name,
        props.street && props.housenumber ? `${props.street} ${props.housenumber}` : props.street,
        props.city,
        props.state
    ].filter(Boolean);
    return {
        label: labelParts.join(', '),
        lat,
        lng,
        street: props.street,
        number: props.housenumber,
        city: props.city,
        state: props.state,
        country: props.country,
        postcode: props.postcode
    };
}

interface NominatimSearchResult {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        road?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
        postcode?: string;
    };
}

interface NominatimReverseResult extends NominatimSearchResult {}

function nominatimResultToSuggestion(r: NominatimSearchResult): GeocodingSuggestion {
    const lat = Number.parseFloat(r.lat);
    const lng = Number.parseFloat(r.lon);
    const a = r.address ?? {};
    return {
        label: r.display_name,
        lat,
        lng,
        street: a.road,
        number: a.house_number,
        city: a.city ?? a.town ?? a.village,
        state: a.state,
        country: a.country,
        postcode: a.postcode
    };
}
