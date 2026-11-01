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
 * HOS-1924: the CORS headers are per-request too. `cors()` runs OUTSIDE this
 * middleware and writes `Access-Control-Allow-Origin` and `Vary: Origin` onto
 * the response before `next()`, so they were stored with the body and a HIT
 * replayed the origin of whoever filled the entry over the origin of the
 * caller being served. Every `access-control-*` header and `vary` is dropped
 * from the entry (see {@link isPerRequestHeader}); on a HIT the ones `cors()`
 * already set for this request stay in place. Nothing inside the cache sets
 * `Vary` itself, so dropping it loses no content negotiation.
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
    'x-ratelimit-reset',
    'vary'
]);

/** Prefix shared by every CORS response header; all of them describe the caller. */
const CORS_HEADER_PREFIX = 'access-control-';

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
    const lower = name.toLowerCase();
    return PER_REQUEST_HEADERS.has(lower) || lower.startsWith(CORS_HEADER_PREFIX);
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

/**
 * Whether a stored header map carries a content-length (case-insensitive).
 *
 * @param params.headers - Headers stored with the cache entry.
 * @returns `true` when a content-length header was stored.
 */
function hasContentLength({ headers }: { readonly headers: Record<string, string> }): boolean {
    return Object.keys(headers).some((name) => name.toLowerCase() === 'content-length');
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
 * The cookie keys Better Auth (1.7) writes after the `<prefix>.` part of a
 * cookie name: the session token, the `session.cookieCache` payload, the
 * remember-me marker and the account-data cookie (HOS-1924).
 *
 * Recognising a cookie by its KEY as well as by the deployment prefix is the
 * fail-closed half: a third `cookiePrefix` nobody added to
 * {@link AUTH_COOKIE_NAME_PREFIXES} still ends in `.session_token`, so it is
 * still treated as a credential. The names are read back from the real
 * instance by `test/middlewares/cache.auth-cookie-names.test.ts`, which fails
 * if Better Auth adds a cookie this list and the prefixes both miss.
 */
const AUTH_COOKIE_KEY_SUFFIXES: readonly string[] = [
    '.session_token',
    '.session_data',
    '.dont_remember',
    '.account_data'
];

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

    const rawCookie = c.req.header('Cookie');
    if (rawCookie === undefined) return false;

    // Fail closed (HOS-1924): a Cookie header we cannot read is ambiguous, and an
    // ambiguous request must not be served from nor stored in the shared cache.
    let names: string[];
    try {
        names = Object.keys(getCookie(c));
    } catch {
        return true;
    }
    if (names.length === 0) return rawCookie.trim().length > 0;

    return names.some(
        (name) =>
            AUTH_COOKIE_NAME_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
            AUTH_COOKIE_KEY_SUFFIXES.some((suffix) => name.endsWith(suffix))
    );
}

/**
 * Determines the cache key for a request based on endpoint classification.
 * Returns null if the request should not be cached.
 */
function generateCacheKey({
    path,
    queryString,
    publicEndpoints,
    privateEndpoints,
    noCacheEndpoints
}: {
    readonly path: string;
    /** Normalised query string (no leading `?`), or empty string. */
    readonly queryString: string;
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
    // HOS-1924: a request carrying credentials never reaches this key (see
    // `requestCarriesCredentials`), so the old per-`Authorization` suffix was
    // unreachable. Only anonymous requests are keyed, and they share one slot.
    if (isPrivate) return `private:${path}${suffix}:anonymous`;

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
        // c.req.url is the full URL including query string. Splitting on
        // the first `?` gives us the query without the leading mark; an
        // empty string when there's no query.
        const queryString = c.req.url.split('?')[1] ?? '';

        const key = generateCacheKey({
            path,
            queryString,
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
                // re-stamped one can differ when the id length differs. Only
                // rewrite it when the entry carried one: adding a length the
                // MISS never had makes hono/compress skip bodies under its
                // threshold, so a HIT would lose the gzip the MISS got.
                if (hasContentLength({ headers: cached.headers })) {
                    c.header('Content-Length', String(new TextEncoder().encode(body).length));
                }
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
