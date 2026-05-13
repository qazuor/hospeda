/**
 * In-memory cache middleware with TTL support.
 * Replaces the Web Standards Cache API (which is unavailable in Node.js)
 * with a simple Map-based cache that supports TTL expiration and LRU eviction.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { getCacheConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';
import {
    NO_CACHE_ENDPOINTS,
    PRIVATE_CACHE_ENDPOINTS,
    PUBLIC_CACHE_ENDPOINTS
} from './cache.constants';

/** Cached response entry stored in the in-memory cache */
interface CacheEntry {
    readonly body: string;
    readonly status: number;
    readonly headers: Record<string, string>;
    readonly expires: number;
}

/** Maximum number of entries in the cache before eviction */
const MAX_ENTRIES = 100;

/** In-memory cache store */
const cache = new Map<string, CacheEntry>();

/**
 * Retrieves a cached entry by key, returning null if expired or missing.
 * Expired entries are automatically evicted.
 */
function getCached({ key }: { readonly key: string }): CacheEntry | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry;
}

/**
 * Stores a response in the cache with a TTL.
 * Evicts the oldest entry (first inserted) when at capacity.
 */
function setCached({ key, entry }: { readonly key: string; readonly entry: CacheEntry }): void {
    // Evict oldest if at capacity
    if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(key, entry);
}

/**
 * Clears all entries from the cache.
 * Useful for testing.
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Returns the current number of entries in the cache.
 * Useful for testing.
 */
export function getCacheSize(): number {
    return cache.size;
}

/** Status codes that are eligible for caching */
const CACHEABLE_STATUS_CODES: ReadonlySet<number> = new Set([200, 404]);

/**
 * Determines the cache key for a request based on endpoint classification.
 * Returns null if the request should not be cached.
 */
function generateCacheKey({
    path,
    queryString,
    authorization,
    publicEndpoints,
    privateEndpoints,
    noCacheEndpoints
}: {
    readonly path: string;
    /** Normalised query string (no leading `?`), or empty string. */
    readonly queryString: string;
    readonly authorization: string | undefined;
    readonly publicEndpoints: readonly string[];
    readonly privateEndpoints: readonly string[];
    readonly noCacheEndpoints: readonly string[];
}): string | null {
    const isNoCache = noCacheEndpoints.some((endpoint) => path.startsWith(endpoint));
    if (isNoCache) return null;

    // SPEC-103 T-089 / T-091: include the query string in the cache key.
    // Without this, requests to the same path with different query params
    // (e.g. ?entityId=A vs ?entityId=B, or ?withCounts=true vs without)
    // collide on a single cache slot and the first response wins.
    const suffix = queryString.length > 0 ? `?${queryString}` : '';

    const isPublic = publicEndpoints.some((endpoint) => path.startsWith(endpoint));
    if (isPublic) return `public:${path}${suffix}`;

    const isPrivate = privateEndpoints.some((endpoint) => path.startsWith(endpoint));
    if (isPrivate) return `private:${path}${suffix}:${authorization ?? 'anonymous'}`;

    // Unclassified endpoints are not cached
    return null;
}

/**
 * Creates cache middleware with environment-based configuration.
 * Uses an in-memory Map with TTL expiration and LRU-style eviction.
 * Only caches GET requests with cacheable status codes (200, 404).
 * Adds X-Cache header (HIT or MISS) to all responses passing through.
 */
export const createCacheMiddleware = (): MiddlewareHandler<AppBindings> => {
    const cacheConfig = getCacheConfig();

    if (!cacheConfig.enabled) {
        apiLogger.info('Cache middleware disabled via configuration (CACHE_ENABLED=false)');
        return async (_c, next) => {
            await next();
        };
    }

    const ttlMs = cacheConfig.maxAge * 1000;

    apiLogger.info(
        `Cache middleware enabled: in-memory cache with ${cacheConfig.maxAge}s TTL, max ${MAX_ENTRIES} entries`
    );

    return async (c, next) => {
        // Only cache GET requests
        if (c.req.method !== 'GET') {
            await next();
            return;
        }

        const path = c.req.path;
        const authorization = c.req.header('Authorization');
        // c.req.url is the full URL including query string. Splitting on
        // the first `?` gives us the query without the leading mark; an
        // empty string when there's no query.
        const queryString = c.req.url.split('?')[1] ?? '';

        const key = generateCacheKey({
            path,
            queryString,
            authorization,
            publicEndpoints: PUBLIC_CACHE_ENDPOINTS,
            privateEndpoints: PRIVATE_CACHE_ENDPOINTS,
            noCacheEndpoints: NO_CACHE_ENDPOINTS
        });

        // If no cache key generated, skip caching
        if (!key) {
            await next();
            return;
        }

        // Check for cached response
        const cached = getCached({ key });
        if (cached) {
            c.header('X-Cache', 'HIT');
            for (const [name, value] of Object.entries(cached.headers)) {
                c.header(name, value);
            }
            return c.body(cached.body, cached.status as 200);
        }

        // Cache miss - execute handler
        await next();

        // Only cache successful/cacheable responses
        const status = c.res.status;
        if (!CACHEABLE_STATUS_CODES.has(status)) {
            c.header('X-Cache', 'MISS');
            return;
        }

        // Clone response body for caching
        try {
            const responseBody = await c.res.clone().text();
            const headers: Record<string, string> = {};
            c.res.headers.forEach((value, name) => {
                // Skip the x-cache header itself from being cached
                if (name !== 'x-cache') {
                    headers[name] = value;
                }
            });

            setCached({
                key,
                entry: {
                    body: responseBody,
                    status,
                    headers,
                    expires: Date.now() + ttlMs
                }
            });
        } catch {
            // If cloning fails, just continue without caching
            apiLogger.warn(`Failed to cache response for ${path}`);
        }

        c.header('X-Cache', 'MISS');
    };
};

/**
 * Default cache middleware instance.
 * Uses environment-based configuration.
 */
export const cacheMiddleware = (): MiddlewareHandler<AppBindings> => createCacheMiddleware();
