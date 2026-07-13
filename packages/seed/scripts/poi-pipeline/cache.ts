/**
 * HOS-141 T-008 — Geocode cache (pipeline stage 5c, §6.3.3, G-6 idempotency).
 *
 * A flat JSON cache keyed by the EXACT address string sent to the geocoder
 * (including the regional qualifier). It wraps any {@link Geocoder}:
 * previously-resolved addresses are a pure lookup, so re-running the pipeline
 * against an unchanged CSV with a warm cache makes ZERO network calls. A
 * "no match" (`null`) is cached too (by key presence), so a known-empty
 * address is never re-queried. The cache file is committed to the repo so the
 * audit trail survives whoever runs the pipeline next.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Geocoder, RawGeocodeHit } from './geocoder.js';

/** Injectable persistence seam for the cache (file-backed by default). */
export interface CacheIO {
    /** Returns the raw cache file contents, or `null` if it does not exist. */
    read(): string | null;
    /** Persists the raw cache file contents. */
    write(contents: string): void;
}

/**
 * Builds a file-backed {@link CacheIO} for a cache path.
 *
 * @param path - Absolute path to the JSON cache file.
 * @returns A file-backed cache IO.
 */
export function fileCacheIO(path: string): CacheIO {
    return {
        read: () => (existsSync(path) ? readFileSync(path, 'utf8') : null),
        write: (contents) => writeFileSync(path, contents)
    };
}

/** The on-disk cache shape: address key -> hit (or `null` for a known miss). */
type CacheData = Record<string, RawGeocodeHit | null>;

/**
 * A cached geocoder plus its resolved-so-far stats.
 */
export interface CachedGeocoder extends Geocoder {
    /** Number of live provider calls made (cache misses) since construction. */
    readonly networkCalls: number;
}

/**
 * Wraps a {@link Geocoder} with a persistent JSON cache.
 *
 * @param params.geocoder - The underlying (e.g. Nominatim) geocoder.
 * @param params.io - Persistence seam (default file-backed via {@link fileCacheIO}).
 * @returns A cached geocoder that persists every newly-resolved address.
 */
export function createCachedGeocoder(params: {
    readonly geocoder: Geocoder;
    readonly io: CacheIO;
}): CachedGeocoder {
    const { geocoder, io } = params;

    const raw = io.read();
    const cache: Map<string, RawGeocodeHit | null> = new Map(
        raw ? Object.entries(JSON.parse(raw) as CacheData) : []
    );

    let networkCalls = 0;

    const persist = (): void => {
        const asObject: CacheData = Object.fromEntries(cache);
        io.write(`${JSON.stringify(asObject, null, 4)}\n`);
    };

    const wrapper: CachedGeocoder = {
        get networkCalls() {
            return networkCalls;
        },
        resolve: async (address: string): Promise<RawGeocodeHit | null> => {
            if (cache.has(address)) {
                return cache.get(address) ?? null;
            }
            networkCalls += 1;
            const hit = await geocoder.resolve(address);
            cache.set(address, hit);
            persist();
            return hit;
        }
    };

    return wrapper;
}
