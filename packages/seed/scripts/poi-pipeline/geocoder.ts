/**
 * HOS-141 T-006 — Geocoder abstraction + Nominatim provider (pipeline stage 5a).
 *
 * Provider-agnostic `Geocoder` interface with a Nominatim (OpenStreetMap)
 * implementation (OQ-3: Nominatim chosen — free, ToS-safe for permanent
 * storage). The provider is a one-line swap so a Mapbox fallback (OQ-3) needs
 * no caller changes. Honors Nominatim's usage policy: a >=1000ms delay between
 * requests, a descriptive User-Agent, retry-with-backoff on 429/5xx, and a
 * hard total-run-time cap so a stalled network cannot hang the batch.
 */

/**
 * A raw geocoding hit, before confidence tiering (T-007). Carries the
 * provider's own match-quality signals so the tiering step can decide whether
 * to accept the coordinate.
 */
export interface RawGeocodeHit {
    /** Resolved latitude. */
    readonly lat: number;
    /** Resolved longitude. */
    readonly long: number;
    /** Provider match-importance signal (Nominatim `importance`, 0..1). */
    readonly importance: number;
    /** Provider feature class (Nominatim `class`, e.g. `place`, `amenity`). */
    readonly featureClass: string;
    /** Provider feature type (Nominatim `type`, e.g. `city`, `townhall`). */
    readonly featureType: string;
    /** Provider's human-readable matched name. */
    readonly displayName: string;
    /** Provider identifier that produced this hit. */
    readonly provider: string;
}

/**
 * Provider-agnostic geocoder: resolves an address string to a raw hit, or
 * `null` when the provider returns no match.
 */
export interface Geocoder {
    resolve(address: string): Promise<RawGeocodeHit | null>;
}

/**
 * Options for {@link createNominatimGeocoder}. The `fetchFn`, `sleep`, and
 * `now` seams exist so tests can drive timing/HTTP deterministically without
 * real network or real clocks.
 */
export interface NominatimOptions {
    /** Descriptive User-Agent (required by Nominatim ToS). */
    readonly userAgent: string;
    /** Minimum ms between requests (Nominatim policy: >=1000). Default 1100. */
    readonly minIntervalMs?: number;
    /** Max retries on 429/5xx. Default 3. */
    readonly maxRetries?: number;
    /** Base backoff ms (doubled per retry). Default 1000. */
    readonly backoffBaseMs?: number;
    /** Hard cap on total wall-clock runtime; exceeding it throws. Optional. */
    readonly maxTotalRuntimeMs?: number;
    /** Base search URL. Default the public Nominatim instance. */
    readonly baseUrl?: string;
    /** Injectable fetch (default global `fetch`). */
    readonly fetchFn?: typeof fetch;
    /** Injectable sleep (default real `setTimeout`). */
    readonly sleep?: (ms: number) => Promise<void>;
    /** Injectable clock (default `Date.now`). */
    readonly now?: () => number;
}

const DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org/search';

/** Real-time sleep used when no `sleep` seam is injected. */
const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses the first result of a Nominatim `jsonv2` response into a
 * {@link RawGeocodeHit}, or `null` when the response has no usable result.
 *
 * @param body - Parsed JSON body (expected to be an array).
 * @returns The first hit, or `null`.
 */
export function parseNominatimBody(body: unknown): RawGeocodeHit | null {
    if (!Array.isArray(body) || body.length === 0) {
        return null;
    }
    const first = body[0] as Record<string, unknown>;
    const lat = Number(first.lat);
    const long = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(long)) {
        return null;
    }
    return {
        lat,
        long,
        importance: Number(first.importance) || 0,
        featureClass: typeof first.class === 'string' ? first.class : '',
        featureType: typeof first.type === 'string' ? first.type : '',
        displayName: typeof first.display_name === 'string' ? first.display_name : '',
        provider: 'nominatim'
    };
}

/**
 * Creates a rate-limited, retrying Nominatim geocoder (OQ-3).
 *
 * @param options - See {@link NominatimOptions}.
 * @returns A {@link Geocoder}.
 */
export function createNominatimGeocoder(options: NominatimOptions): Geocoder {
    const {
        userAgent,
        minIntervalMs = 1100,
        maxRetries = 3,
        backoffBaseMs = 1000,
        maxTotalRuntimeMs,
        baseUrl = DEFAULT_BASE_URL,
        fetchFn = fetch,
        sleep = realSleep,
        now = Date.now
    } = options;

    const startedAt = now();
    let lastRequestAt = Number.NEGATIVE_INFINITY;

    const buildUrl = (address: string): string => {
        const params = new URLSearchParams({
            q: address,
            format: 'jsonv2',
            limit: '1',
            countrycodes: 'ar',
            addressdetails: '0'
        });
        return `${baseUrl}?${params.toString()}`;
    };

    const enforceRateLimit = async (): Promise<void> => {
        const waitMs = minIntervalMs - (now() - lastRequestAt);
        if (waitMs > 0) {
            await sleep(waitMs);
        }
    };

    const enforceRuntimeCap = (): void => {
        if (maxTotalRuntimeMs !== undefined && now() - startedAt > maxTotalRuntimeMs) {
            throw new Error(
                `Geocoder run-time cap of ${maxTotalRuntimeMs}ms exceeded; aborting to avoid a hung batch.`
            );
        }
    };

    const resolve = async (address: string): Promise<RawGeocodeHit | null> => {
        const url = buildUrl(address);
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            enforceRuntimeCap();
            await enforceRateLimit();
            lastRequestAt = now();

            const response = await fetchFn(url, {
                headers: { 'User-Agent': userAgent, Accept: 'application/json' }
            });

            if (response.status === 429 || response.status >= 500) {
                if (attempt === maxRetries) {
                    throw new Error(
                        `Geocoder gave up after ${maxRetries + 1} attempts (last status ${response.status}) for '${address}'.`
                    );
                }
                await sleep(backoffBaseMs * 2 ** attempt);
                continue;
            }

            if (!response.ok) {
                return null;
            }

            const body = (await response.json()) as unknown;
            return parseNominatimBody(body);
        }
        return null;
    };

    return { resolve };
}
