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
    /**
     * The `metadata.requestId` the stored body was written with, or `null` when
     * the body is not a JSON object carrying one (HOS-1915). Computed once on
     * the MISS so a HIT never parses the body.
     */
    readonly storedRequestId: string | null;
}

/**
 * Response headers that describe THIS request rather than the payload, and so
 * must never be stored alongside a cached body.
 *
 * H-162 (smoke agosto 2026): the rate-limit headers were being captured with
 * the body and replayed on every hit for the whole TTL. Because a cache hit is
 * served before the rate-limit middleware ever runs, the replayed
 * `ratelimit-remaining` was a fossil from whenever the entry was written — 60
 * consecutive requests all reported `199`, which read as "the limiter is not
 * counting". Correlating the header against the Redis counter showed the
 * limiter counts correctly on every miss; only the cached copy lied.
 *
 * `x-cache` is here for a different reason: it is set fresh on both paths, so
 * caching it would make a hit claim to be a miss.
 *
 * HOS-1915: `x-request-id` belongs here too. The id is minted by
 * `hono/request-id` for every request, so replaying the stored one made N
 * distinct requests report the id of whichever one wrote the entry. On a hit
 * the header set by that middleware earlier in the chain stays in place. The
 * matching `metadata.requestId` inside the body is re-stamped separately
 * (see `restampRequestId`).
 *
 * Keep this list to headers that are genuinely per-request. Anything that
 * describes the body (`content-type`, `etag`, `cache-control`, …) MUST keep
 * being cached — dropping those would break content negotiation and
 * revalidation far worse than a stale counter ever did.
 */
const PER_REQUEST_HEADERS: ReadonlySet<string> = new Set([
    'x-cache',
    'x-request-id',
    'ratelimit-limit',
    'ratelimit-remaining',
    'ratelimit-reset',
    'ratelimit-policy',
    'retry-after',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset'
]);

/**
 * Whether a response header describes this request rather than the payload,
 * and therefore must be excluded from the cached entry.
 *
 * @param name - Header name. Hono lower-cases header names when iterating
 *   `Response.headers`, but this normalises defensively so a future caller
 *   passing mixed case cannot silently reintroduce the H-162 fossil.
 * @returns `true` when the header must not be cached.
 */
function isPerRequestHeader(name: string): boolean {
    return PER_REQUEST_HEADERS.has(name.toLowerCase());
}

/**
 * Extracts `metadata.requestId` from a response body when it is a JSON object
 * whose `metadata.requestId` is a string, i.e. the envelope shape built by the
 * response formatter. Parses once, on the MISS only.
 *
 * @param params.body - Raw response body text.
 * @param params.contentType - Value of the `content-type` header, if any.
 * @returns The stored request id, or `null` when the body has none.
 */
function extractStoredRequestId({
    body,
    contentType
}: {
    readonly body: string;
    readonly contentType: string | undefined;
}): string | null {
    if (!contentType?.toLowerCase().includes('json')) return null;
    try {
        const parsed: unknown = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null) return null;
        const metadata = (parsed as { metadata?: unknown }).metadata;
        if (typeof metadata !== 'object' || metadata === null) return null;
        const id = (metadata as { requestId?: unknown }).requestId;
        return typeof id === 'string' && id.length > 0 ? id : null;
    } catch {
        return null;
    }
}

/**
 * Swaps the stored request id for the current one in a cached JSON body
 * (HOS-1915) with a string splice, so a HIT stays O(n) with no parse.
 *
 * Request ids are unique per request, so the stored id string only appears in
 * the `metadata.requestId` field; the LAST occurrence is used because the
 * envelope serialises `metadata` after `data`, which also protects against a
 * data field that happens to contain the same literal text. If the pattern is
 * not found (e.g. a non-compact serialisation) the body is served unchanged.
 * `timestamp` is intentionally left as stored: it dates the cached payload.
 *
 * @param params.body - Cached body text.
 * @param params.storedRequestId - Id the body was cached with.
 * @param params.requestId - Id of the request being served.
 * @returns The body carrying the current request id.
 */
function restampRequestId({
    body,
    storedRequestId,
    requestId
}: {
    readonly body: string;
    readonly storedRequestId: string;
    readonly requestId: string;
}): string {
    const needle = `"requestId":${JSON.stringify(storedRequestId)}`;
    const index = body.lastIndexOf(needle);
    if (index === -1) return body;
    return (
        body.slice(0, index) +
        `"requestId":${JSON.stringify(requestId)}` +
        body.slice(index + needle.length)
    );
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
            const currentRequestId = c.get('requestId');
            // The empty-id branch is unreachable in the real app: requestId()
            // is the first middleware in create-app.ts, so the id always exists.
            if (cached.storedRequestId !== null && currentRequestId) {
                const body = restampRequestId({
                    body: cached.body,
                    storedRequestId: cached.storedRequestId,
                    requestId: currentRequestId
                });
                // The stored content-length describes the original body; the
                // re-stamped one can differ when the id length differs.
                c.header('Content-Length', String(new TextEncoder().encode(body).length));
                return c.body(body, cached.status as 200);
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
                if (!isPerRequestHeader(name)) {
                    headers[name] = value;
                }
            });

            setCached({
                key,
                entry: {
                    body: responseBody,
                    status,
                    headers,
                    expires: Date.now() + ttlMs,
                    storedRequestId: extractStoredRequestId({
                        body: responseBody,
                        contentType: c.res.headers.get('content-type') ?? undefined
                    })
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
