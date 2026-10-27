/**
 * In-memory cache middleware with TTL support.
 * Replaces the Web Standards Cache API (which is unavailable in Node.js)
 * with a simple Map-based cache that supports TTL expiration and LRU eviction.
 */
import { DEFAULT_AUTH_COOKIE_PREFIX, STAGING_AUTH_COOKIE_PREFIX } from '@repo/config';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
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
 * Keep this list to headers that are genuinely per-request. Anything that
 * describes the body (`content-type`, `etag`, `cache-control`, …) MUST keep
 * being cached — dropping those would break content negotiation and
 * revalidation far worse than a stale counter ever did.
 */
const PER_REQUEST_HEADERS: ReadonlySet<string> = new Set([
    'x-cache',
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
 * Cookie-name prefixes Better Auth writes for every Hospeda deployment
 * (HOS-1923). Better Auth names its cookies `<prefix>.<cookie>` —
 * `session_token`, the `session_data` cookie cache, `dont_remember` — and adds
 * `__Secure-` when `useSecureCookies` is on (`NODE_ENV=production`).
 *
 * Both deployment prefixes are listed, not only the one this process resolves:
 * staging and production share the apex cookie domain, so a request can carry
 * either. Bypassing on the other environment's cookie only costs a cache hit,
 * while missing this environment's would serve a session-bound body to
 * strangers. Resolved from `@repo/config`, the same source `lib/auth.ts` uses.
 */
const AUTH_COOKIE_NAME_PREFIXES: readonly string[] = [
    DEFAULT_AUTH_COOKIE_PREFIX,
    STAGING_AUTH_COOKIE_PREFIX
].flatMap((prefix) => [`${prefix}.`, `__Secure-${prefix}.`]);

/**
 * Test-only headers that make the harness build an actor
 * (`test/helpers/mockAuthMiddleware.ts`, `middlewares/actor.ts`). Both readers
 * require `x-mock-actor-id`, so its presence alone is the superset.
 */
const MOCK_ACTOR_ID_HEADER = 'x-mock-actor-id';

/**
 * Whether a request carries anything the auth chain could turn into a
 * non-guest actor, in which case the response cache must neither read nor
 * write for it (HOS-1923).
 *
 * The cache runs BEFORE `authMiddleware`/`actorMiddleware` and keys public
 * endpoints without any actor component, so a handler that branches on the
 * actor (draft posts for an author, a user profile for its owner) would have
 * its authenticated answer replayed to anonymous callers for the whole TTL —
 * and an anonymous 404 replayed to the owner.
 *
 * Credentials recognised:
 * - an `Authorization` header (any scheme; the mock auth also reads it);
 * - any Better Auth cookie of a Hospeda deployment, matched by parsed cookie
 *   NAME (never a substring of the raw header), see
 *   {@link AUTH_COOKIE_NAME_PREFIXES};
 * - under `NODE_ENV=test` only, the mock-actor header the test harness honours.
 *
 * Unrelated cookies (`hospeda_vid`, analytics) do not count: an anonymous
 * visitor always carries them and must keep being served from cache.
 *
 * @param params.c - Hono context of the request.
 * @returns `true` when the request must bypass the cache.
 */
function requestCarriesCredentials({ c }: { readonly c: Context<AppBindings> }): boolean {
    if (c.req.header('Authorization') !== undefined) return true;

    // NODE_ENV is a system variable, read directly like `lazyMockAuthMiddleware`
    // in `utils/create-app.ts` decides whether the mock headers are honoured.
    if (process.env.NODE_ENV === 'test' && c.req.header(MOCK_ACTOR_ID_HEADER) !== undefined) {
        return true;
    }

    if (c.req.header('Cookie') === undefined) return false;
    return Object.keys(getCookie(c)).some((name) =>
        AUTH_COOKIE_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))
    );
}

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
 * Adds an X-Cache header to every response of a classified endpoint: HIT or
 * MISS, or BYPASS when the request carries credentials (HOS-1923).
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

        // HOS-1923: a request with credentials is answered for ITS actor, but
        // the key above has no actor in it. Never read nor store such a request.
        if (requestCarriesCredentials({ c })) {
            await next();
            c.header('X-Cache', 'BYPASS');
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
