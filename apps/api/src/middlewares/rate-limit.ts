/**
 * Rate limiting middleware with differentiated limits per endpoint type.
 * Uses Redis when available for multi-instance support, falls back to in-memory Map.
 */
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, Next } from 'hono';
import { env, getRateLimitConfig as getBaseRateLimitConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';

/** Rate limit entry stored in-memory or serialized to Redis */
interface RateLimitEntry {
    readonly count: number;
    readonly windowStart: number;
}

/**
 * Header style for rate-limit response headers.
 * - 'standard' emits IETF `RateLimit-*` headers
 * - 'legacy' emits `X-RateLimit-*` headers
 * - 'both' emits both families
 * - 'none' emits no rate-limit headers
 */
type RateLimitHeaderStyle = 'standard' | 'legacy' | 'both' | 'none';

/**
 * Sets rate-limit response headers on the given target according to the
 * configured header style. The target may be a `Headers` instance (for direct
 * Response building) or a Hono `Context` (for middleware-style header setting).
 *
 * @param params - Target, header style, limit/remaining/reset values, and an
 *   optional debug type tag.
 */
const setRateLimitHeaders = ({
    target,
    style,
    limit,
    remaining,
    reset,
    typeTag
}: {
    readonly target: Headers | Context;
    readonly style: RateLimitHeaderStyle;
    readonly limit: string;
    readonly remaining: string;
    readonly reset: string;
    readonly typeTag?: string;
}): void => {
    if (style === 'none') return;
    const setHeader = (name: string, value: string): void => {
        if (target instanceof Headers) {
            target.set(name, value);
        } else {
            target.header(name, value);
        }
    };
    const emitStandard = style === 'standard' || style === 'both';
    const emitLegacy = style === 'legacy' || style === 'both';
    if (emitStandard) {
        setHeader('RateLimit-Limit', limit);
        setHeader('RateLimit-Remaining', remaining);
        setHeader('RateLimit-Reset', reset);
    }
    if (emitLegacy) {
        setHeader('X-RateLimit-Limit', limit);
        setHeader('X-RateLimit-Remaining', remaining);
        setHeader('X-RateLimit-Reset', reset);
    }
    if (typeTag) {
        setHeader('X-RateLimit-Type', typeTag);
    }
};

/** Abstract rate limit store interface */
interface RateLimitStore {
    get(key: string): Promise<RateLimitEntry | undefined>;
    set(key: string, entry: RateLimitEntry, windowMs: number): Promise<void>;
    has(key: string): Promise<boolean>;
    clear(): Promise<void>;
    deleteByIp(ip: string): Promise<void>;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────────

const memoryStore = new Map<string, RateLimitEntry>();

/** Interval in ms between cleanup sweeps of expired in-memory entries */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum entry lifetime before cleanup (matches longest window: public 1 hour) */
const MAX_ENTRY_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Removes expired entries from the in-memory store to prevent memory leaks.
 * An entry is considered expired when its windowStart is older than MAX_ENTRY_LIFETIME_MS.
 */
export function cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (now - entry.windowStart > MAX_ENTRY_LIFETIME_MS) {
            memoryStore.delete(key);
        }
    }
}

/** Handle for the periodic cleanup interval (undefined in test env) */
let cleanupInterval: ReturnType<typeof setInterval> | undefined;

// pre-validation: must use process.env directly (module-level, before validateApiEnv() runs)
if (process.env.NODE_ENV !== 'test') {
    cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    cleanupInterval.unref(); // Don't prevent process exit
}

/**
 * Stops the periodic cleanup interval. Call during graceful shutdown.
 */
export function stopCleanupInterval(): void {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = undefined;
    }
}

const inMemoryStore: RateLimitStore = {
    async get(key: string) {
        return memoryStore.get(key);
    },
    async set(key: string, entry: RateLimitEntry) {
        memoryStore.set(key, entry);
    },
    async has(key: string) {
        return memoryStore.has(key);
    },
    async clear() {
        memoryStore.clear();
    },
    async deleteByIp(ip: string) {
        for (const key of memoryStore.keys()) {
            if (key.endsWith(`:${ip}`)) {
                memoryStore.delete(key);
            }
        }
    }
};

// ─── Redis Store ──────────────────────────────────────────────────────────────

const REDIS_KEY_PREFIX = 'rl:';

const createRedisStore = (): RateLimitStore => ({
    async get(key: string): Promise<RateLimitEntry | undefined> {
        try {
            const redis = await getRedisClient();
            if (!redis) return inMemoryStore.get(key);

            const data = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
            if (!data) return undefined;
            return JSON.parse(data) as RateLimitEntry;
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable, falling back to in-memory store');
            return inMemoryStore.get(key);
        }
    },
    async set(key: string, entry: RateLimitEntry, windowMs: number): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.set(key, entry, windowMs);
                return;
            }

            const ttlSeconds = Math.ceil(windowMs / 1000);
            await redis.set(`${REDIS_KEY_PREFIX}${key}`, JSON.stringify(entry), 'EX', ttlSeconds);
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable, falling back to in-memory store');
            await inMemoryStore.set(key, entry, windowMs);
        }
    },
    async has(key: string): Promise<boolean> {
        try {
            const redis = await getRedisClient();
            if (!redis) return inMemoryStore.has(key);

            const exists = await redis.exists(`${REDIS_KEY_PREFIX}${key}`);
            return exists === 1;
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable, falling back to in-memory store');
            return inMemoryStore.has(key);
        }
    },
    async clear(): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.clear();
                return;
            }

            // Use SCAN to find and delete all rate limit keys
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(
                    cursor,
                    'MATCH',
                    `${REDIS_KEY_PREFIX}*`,
                    'COUNT',
                    100
                );
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable, falling back to in-memory store');
            await inMemoryStore.clear();
        }
    },
    async deleteByIp(ip: string): Promise<void> {
        try {
            const redis = await getRedisClient();
            if (!redis) {
                await inMemoryStore.deleteByIp(ip);
                return;
            }

            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(
                    cursor,
                    'MATCH',
                    `${REDIS_KEY_PREFIX}*:${ip}`,
                    'COUNT',
                    100
                );
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        } catch (error) {
            apiLogger.warn({ error }, 'Redis unavailable, falling back to in-memory store');
            await inMemoryStore.deleteByIp(ip);
        }
    }
});

// Active store (lazy-initialized)
let activeStore: RateLimitStore | undefined;

const getStore = (): RateLimitStore => {
    if (!activeStore) {
        const redisUrl = env.HOSPEDA_REDIS_URL;
        if (!redisUrl && env.NODE_ENV === 'production') {
            throw new Error(
                'HOSPEDA_REDIS_URL is required in production for effective rate limiting. ' +
                    'In-memory rate limiting is ineffective in serverless environments.'
            );
        }
        activeStore = redisUrl ? createRedisStore() : inMemoryStore;
    }
    return activeStore;
};

/**
 * Clears the rate limit store (useful for testing)
 */
export const clearRateLimitStore = async () => {
    await getStore().clear();
    memoryStore.clear();
};

/**
 * Clears rate limit entries for a specific IP address only.
 * Used during signout to clear only the requesting user's rate limits.
 *
 * @param params - Object containing the IP address to clear
 */
export const clearRateLimitForIp = async ({ ip }: { ip: string }): Promise<void> => {
    await getStore().deleteByIp(ip);
};

/**
 * Resets the store selection (useful for testing)
 */
export const resetRateLimitStore = () => {
    activeStore = undefined;
    memoryStore.clear();
};

// ─── Shared IP Extraction ─────────────────────────────────────────────────────

/**
 * Loopback patterns: IPv4 127.0.0.0/8, IPv6 ::1, and IPv4-mapped IPv6 loopback.
 * These match container-internal traffic (Docker healthchecks, in-container probes).
 */
const LOOPBACK_PATTERNS: readonly RegExp[] = [/^127\./, /^::1$/, /^::ffff:127\./];

/**
 * Private/internal IP patterns: RFC1918 IPv4 (10/8, 172.16/12, 192.168/16),
 * IPv4-mapped IPv6 of the same, and IPv6 unique-local fc00::/7 (fc**: and fd**:).
 * These match traffic from a trusted reverse proxy (Traefik, internal mesh).
 */
const PRIVATE_IP_PATTERNS: readonly RegExp[] = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^::ffff:10\./,
    /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./,
    /^::ffff:192\.168\./,
    /^f[cd][0-9a-f]{2}:/i
];

/**
 * Paths considered healthcheck endpoints. Loopback traffic to these paths bypasses
 * rate limiting entirely to avoid filling shared buckets with internal probe traffic.
 */
const HEALTHCHECK_PATHS: ReadonlySet<string> = new Set([
    '/',
    '/health',
    '/healthz',
    '/readyz',
    '/livez'
]);

/**
 * Returns true when `ip` is a loopback address (IPv4 127.x, IPv6 ::1, or IPv4-mapped IPv6 loopback).
 *
 * @param ip - The IP string to test.
 */
export const isLoopbackIp = (ip: string): boolean => LOOPBACK_PATTERNS.some((p) => p.test(ip));

/**
 * Returns true when `ip` is a private/internal address (RFC1918 IPv4 or IPv6 unique-local).
 *
 * @param ip - The IP string to test.
 */
export const isPrivateIp = (ip: string): boolean => PRIVATE_IP_PATTERNS.some((p) => p.test(ip));

/**
 * Determines whether forwarded-IP headers from a request should be trusted.
 * A socket source is trusted when it is loopback, RFC1918 private, or appears in the
 * explicit `API_RATE_LIMIT_TRUSTED_PROXIES` list.
 *
 * @param socketIp - The IP from the raw TCP socket.
 * @param explicitProxies - Extra trusted proxy IPs from configuration.
 */
const isTrustedSource = (socketIp: string, explicitProxies: readonly string[]): boolean =>
    isLoopbackIp(socketIp) || isPrivateIp(socketIp) || explicitProxies.includes(socketIp);

/**
 * Reads the socket remote address from a Hono context when available.
 *
 * Tries multiple sources in order so the IP is detected across runtimes:
 *
 *   1. `@hono/node-server/conninfo` (`getConnInfo`) — the official adapter
 *      API in `@hono/node-server` 1.19+. Exposes the underlying socket's
 *      remote address.
 *   2. `c.env.incoming.socket.remoteAddress` — direct access to Node's
 *      `IncomingMessage` (older adapter pattern, kept as fallback).
 *   3. `c.req.raw.socket.remoteAddress` — legacy path that worked when
 *      `c.req.raw` was a Node `IncomingMessage`. Modern @hono/node-server
 *      passes a Web `Request` here (no `.socket`), so this path now only
 *      helps custom test harnesses that monkey-patch the raw.
 *
 * Returns `undefined` only in edge/test runtimes that expose none of the
 * above (the caller falls back to header-based IP extraction, then to the
 * literal string `'unknown'`).
 *
 * @param c - The Hono context.
 */
const getSocketIp = (c: Context): string | undefined => {
    // 1) Adapter-provided getConnInfo (preferred under @hono/node-server).
    try {
        const info = getConnInfo(c);
        const address = info?.remote?.address;
        if (typeof address === 'string' && address.length > 0) return address;
    } catch {
        // getConnInfo throws when the adapter doesn't support it (edge, tests).
        // Fall through to the legacy paths.
    }

    // 2) Node `IncomingMessage` exposed via `c.env.incoming` (legacy adapter).
    // TYPE-WORKAROUND: Hono's `Context.env` is generic and untyped at our integration layer; older adapters surface the Node IncomingMessage via `c.env.incoming.socket.remoteAddress`, which the framework does not type. The cast lets us inspect that shape defensively when present.
    const env = (c as unknown as { env?: { incoming?: { socket?: { remoteAddress?: string } } } })
        .env;
    const envAddress = env?.incoming?.socket?.remoteAddress;
    if (typeof envAddress === 'string' && envAddress.length > 0) return envAddress;

    // 3) `c.req.raw.socket.remoteAddress` (only when `raw` is a Node IncomingMessage).
    const raw = c.req.raw as unknown;
    if (raw && typeof raw === 'object' && 'socket' in raw) {
        const socket = (raw as { socket?: { remoteAddress?: string } }).socket;
        const rawAddress = socket?.remoteAddress;
        if (typeof rawAddress === 'string' && rawAddress.length > 0) return rawAddress;
    }

    return undefined;
};

/**
 * Reads the client IP from proxy headers in priority order:
 * cf-connecting-ip → first hop of x-forwarded-for → x-real-ip.
 * Returns undefined when no proxy header is present.
 *
 * @param c - The Hono context.
 */
const readHeaderIp = (c: Context): string | undefined => {
    const cf = c.req.header('cf-connecting-ip');
    if (cf) return cf;

    const xff = c.req.header('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first) return first;
    }

    const xri = c.req.header('x-real-ip');
    if (xri) return xri;

    return undefined;
};

/**
 * Extracts a stable rate-limit identifier from the request, applying a trust-chain
 * validation against the raw socket source.
 *
 * Behaviour:
 * 1. `trustProxy === false`: use the socket IP directly (each client gets its own bucket).
 * 2. No socket available (tests, edge runtimes): fall back to header-based extraction.
 * 3. Socket is loopback (Docker healthcheck, in-container probe): returns `internal:<ip>`.
 *    Combined with the healthcheck-path bypass in {@link rateLimitMiddleware}, this prevents
 *    internal probes from sharing a bucket with anonymous traffic.
 * 4. Socket is a trusted source (RFC1918 / explicit list): trust the proxy headers
 *    (`cf-connecting-ip`, `x-forwarded-for[0]`, `x-real-ip`). When trusted but no headers
 *    present, returns `proxy:<socket-ip>`.
 * 5. Socket is an untrusted source (direct external hit bypassing the reverse proxy):
 *    proxy headers are IGNORED to prevent spoofing. Returns `untrusted:<socket-ip>`.
 *
 * The prefixes (`internal:`, `proxy:`, `untrusted:`) are part of the rate-limit key, so
 * different source classes never collide in one bucket. They also surface in log lines
 * via `getClientIp` callers in auth handlers, making request origin obvious in audit logs.
 *
 * @param params - Object containing the Hono context.
 * @returns The rate-limit identifier string.
 */
export const getClientIp = ({ c }: { c: Context }): string => {
    const baseRateLimitConfig = getBaseRateLimitConfig();
    const trustProxy = baseRateLimitConfig.trustProxy;
    const trustedProxies: readonly string[] = baseRateLimitConfig.trustedProxies ?? [];
    const socketIp = getSocketIp(c);

    if (!trustProxy) {
        return socketIp ?? readHeaderIp(c) ?? 'unknown';
    }

    if (!socketIp) {
        return readHeaderIp(c) ?? 'unknown';
    }

    if (isLoopbackIp(socketIp)) {
        return `internal:${socketIp}`;
    }

    if (isTrustedSource(socketIp, trustedProxies)) {
        const headerIp = readHeaderIp(c);
        if (headerIp) return headerIp;
        return `proxy:${socketIp}`;
    }

    return `untrusted:${socketIp}`;
};

// ─── Per-Route Rate Limit Middleware ──────────────────────────────────────────

/**
 * Creates a per-route rate limit middleware that enforces custom limits.
 * This runs as a route-level middleware, AFTER the global rate limiter,
 * applying stricter per-route limits on top of the global tier limits.
 *
 * @param params - Custom rate limit configuration
 * @returns Hono middleware handler
 */
export const createPerRouteRateLimitMiddleware = ({
    requests,
    windowMs
}: {
    requests: number;
    windowMs: number;
}): ((c: Context, next: Next) => Promise<undefined | Response>) => {
    return async (c: Context, next: Next) => {
        // Skip in test environment unless explicitly testing
        if (env.NODE_ENV === 'test' && !env.HOSPEDA_TESTING_RATE_LIMIT) {
            await next();
            return;
        }

        const baseRateLimitConfig = getBaseRateLimitConfig();
        const clientIp = getClientIp({ c });
        const path = c.req.path;
        const method = c.req.method.toUpperCase();
        const store = getStore();
        const now = Date.now();
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const resetTime = windowStart + windowMs;

        // Per-route limits are method-scoped so endpoints sharing a path
        // (e.g. GET vs PATCH /users/:id) keep independent buckets. Without
        // the method in the key, a flurry of reads would tighten the bucket
        // for writes on the same path — especially painful when the read
        // limit (e.g. 100/min) is higher than the write limit (e.g. 20/min).
        const storeKey = `route:${method}:${path}:${clientIp}`;

        const currentData = await store.get(storeKey);
        let count = 0;

        if (currentData && currentData.windowStart === windowStart) {
            count = currentData.count;
        }

        if (count >= requests) {
            const responseBody = {
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests to this endpoint. Please try again later.',
                    reason: 'RATE_LIMIT_EXCEEDED'
                }
            };

            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', 'application/json');
            responseHeaders.set('Retry-After', Math.ceil((resetTime - now) / 1000).toString());
            setRateLimitHeaders({
                target: responseHeaders,
                style: baseRateLimitConfig.headers,
                limit: requests.toString(),
                remaining: '0',
                reset: Math.floor(resetTime / 1000).toString(),
                typeTag: 'per-route'
            });

            return new Response(JSON.stringify(responseBody), {
                status: 429,
                headers: responseHeaders
            });
        }

        await store.set(storeKey, { count: count + 1, windowStart }, windowMs);

        setRateLimitHeaders({
            target: c,
            style: baseRateLimitConfig.headers,
            limit: requests.toString(),
            remaining: (requests - count - 1).toString(),
            reset: Math.floor(resetTime / 1000).toString(),
            typeTag: 'per-route'
        });

        await next();
    };
};

/** Supported rate limit endpoint categories */
export type RateLimitEndpointType =
    | 'auth'
    | 'public'
    | 'admin'
    | 'billing'
    | 'webhook'
    | 'ai-inbound'
    | 'make-callback'
    | 'general';

/**
 * Determines the endpoint type based on the request path and method.
 *
 * The order matters: more specific categories are checked before broader ones
 * so that, for example, a POST to a billing path under `/admin/` still gets
 * the restrictive billing limits, and machine-to-machine endpoints (`ai-inbound`,
 * `make-callback`) are classified before the broad `admin`/`public` buckets.
 *
 * Classification order (first match wins):
 *   1. `webhook`      — paths containing `/webhooks/` or `/webhook/`
 *   2. `billing`      — POST requests on paths containing `/billing/`
 *   3. `ai-inbound`   — `/api/v1/ai/*` (Custom GPT inbound calls)
 *   4. `make-callback` — `/api/v1/integrations/make/*` (Make.com callbacks)
 *   5. `auth`         — auth paths
 *   6. `admin`        — `/api/v1/admin/*`
 *   7. `public`       — `/api/v1/public/*`
 *   8. `general`      — everything else
 *
 * @param path - The request path
 * @param method - The HTTP method (uppercase)
 * @returns The endpoint type for rate limiting configuration
 */
export const getEndpointType = (path: string, method: string): RateLimitEndpointType => {
    // Webhook endpoints get their own high-throughput bucket
    if (path.includes('/webhooks/') || path.includes('/webhook/')) {
        return 'webhook';
    }
    // Financial POST operations on billing paths get restrictive limits
    if (path.includes('/billing/') && method === 'POST') {
        return 'billing';
    }
    // Custom GPT inbound calls: catalog GET, drafts POST, etc.
    // Paths are /api/v1/ai/* — does NOT contain "/webhook" so no collision above.
    if (path.startsWith('/api/v1/ai/')) {
        return 'ai-inbound';
    }
    // Make.com callbacks: /claim, /result, dispatch, etc.
    // Paths are /api/v1/integrations/make/* — no "/webhook" segment, no collision above.
    if (path.startsWith('/api/v1/integrations/make/')) {
        return 'make-callback';
    }
    if (
        path.startsWith('/api/auth/') ||
        path.startsWith('/api/v1/auth/') ||
        path.startsWith('/api/v1/public/auth/') ||
        path.startsWith('/api/v1/protected/auth/')
    ) {
        return 'auth';
    }
    if (path.startsWith('/api/v1/admin/')) {
        return 'admin';
    }
    if (path.startsWith('/api/v1/public/')) {
        return 'public';
    }
    return 'general';
};

/**
 * Gets rate limiting configuration for a specific endpoint type.
 *
 * @param endpointType - The category of endpoint
 * @returns Rate limiting configuration for the endpoint type
 */
const getRateLimitConfig = (endpointType: RateLimitEndpointType) => {
    const baseConfig = getBaseRateLimitConfig();

    switch (endpointType) {
        case 'auth':
            return {
                enabled: baseConfig.authEnabled,
                windowMs: baseConfig.authWindowMs,
                maxRequests: baseConfig.authMaxRequests,
                message: baseConfig.authMessage,
                headers: baseConfig.headers
            };
        case 'public':
            return {
                enabled: baseConfig.publicEnabled,
                windowMs: baseConfig.publicWindowMs,
                maxRequests: baseConfig.publicMaxRequests,
                message: baseConfig.publicMessage,
                headers: baseConfig.headers
            };
        case 'admin':
            return {
                enabled: baseConfig.adminEnabled,
                windowMs: baseConfig.adminWindowMs,
                maxRequests: baseConfig.adminMaxRequests,
                message: baseConfig.adminMessage,
                headers: baseConfig.headers
            };
        case 'billing':
            return {
                enabled: baseConfig.billingEnabled,
                windowMs: baseConfig.billingWindowMs,
                maxRequests: baseConfig.billingMaxRequests,
                message: baseConfig.billingMessage,
                headers: baseConfig.headers
            };
        case 'webhook':
            return {
                enabled: baseConfig.webhookEnabled,
                windowMs: baseConfig.webhookWindowMs,
                maxRequests: baseConfig.webhookMaxRequests,
                message: baseConfig.webhookMessage,
                headers: baseConfig.headers
            };
        case 'ai-inbound':
            // Intentionally maps to the webhook bucket: high-throughput machine-to-machine
            // traffic with the same traffic profile as webhooks. No new env vars required.
            return {
                enabled: baseConfig.webhookEnabled,
                windowMs: baseConfig.webhookWindowMs,
                maxRequests: baseConfig.webhookMaxRequests,
                message: baseConfig.webhookMessage,
                headers: baseConfig.headers
            };
        case 'make-callback':
            // Intentionally maps to the webhook bucket: Make.com callbacks are machine-to-machine
            // traffic with the same profile as webhooks. No new env vars / Coolify actions needed.
            return {
                enabled: baseConfig.webhookEnabled,
                windowMs: baseConfig.webhookWindowMs,
                maxRequests: baseConfig.webhookMaxRequests,
                message: baseConfig.webhookMessage,
                headers: baseConfig.headers
            };
        default:
            return {
                enabled: baseConfig.enabled,
                windowMs: baseConfig.windowMs,
                maxRequests: baseConfig.maxRequests,
                message: baseConfig.message,
                headers: baseConfig.headers
            };
    }
};

/**
 * Rate limiting middleware with environment-based configuration.
 * Uses Redis when HOSPEDA_REDIS_URL is configured, otherwise falls back to in-memory.
 */
export const rateLimitMiddleware = async (c: Context, next: Next) => {
    // Skip rate limiting in test environment UNLESS explicitly testing it
    if (env.NODE_ENV === 'test' && !env.HOSPEDA_TESTING_RATE_LIMIT) {
        await next();
        return;
    }

    const path = c.req.path;
    const method = c.req.method.toUpperCase();
    const endpointType = getEndpointType(path, method);
    const config = getRateLimitConfig(endpointType);

    // Skip if rate limiting is disabled for this endpoint type
    if (!config.enabled) {
        await next();
        return;
    }

    // Get client IP using shared extraction utility
    const clientIp = getClientIp({ c });

    // (A) Bypass rate limiting for loopback healthcheck traffic. Docker/Coolify probe the
    // container every ~30s via http://localhost:3001/ — those hits should never fill a bucket.
    // We only bypass when BOTH the source is loopback AND the path is a known healthcheck,
    // so a compromised process opening a local socket can't trivially bypass external limits.
    if (clientIp.startsWith('internal:') && HEALTHCHECK_PATHS.has(path)) {
        await next();
        return;
    }

    // (D) Surface any remaining 'unknown' fallback in logs. With the trust-chain rewrite this
    // should be near-impossible in prod (only fires when there is no socket AND no proxy
    // headers — e.g. a misconfigured test harness). If it appears in monitoring, investigate.
    if (clientIp === 'unknown') {
        apiLogger.warn(
            {
                event: 'rate_limit.unknown_source',
                path,
                method,
                hasCfConnectingIp: c.req.header('cf-connecting-ip') !== undefined,
                hasForwardedFor: c.req.header('x-forwarded-for') !== undefined,
                hasRealIp: c.req.header('x-real-ip') !== undefined
            },
            'Rate limiter could not identify request source — falling back to shared "unknown" bucket'
        );
    }

    const store = getStore();
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetTime = windowStart + config.windowMs;

    // Composite key: endpointType + IP for proper per-tier rate limiting
    const storeKey = `${endpointType}:${clientIp}`;

    // Get current rate limit data
    const currentData = await store.get(storeKey);
    let count = 0;

    if (currentData && currentData.windowStart === windowStart) {
        // Still in the same window
        count = currentData.count;
    }

    // Check if rate limit exceeded
    if (count >= config.maxRequests) {
        // Preserve existing CORS headers before setting rate limit headers
        const existingCorsHeaders = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers',
            'Access-Control-Allow-Credentials',
            'Access-Control-Max-Age'
        ];

        const corsHeaders: Record<string, string> = {};
        for (const corsHeader of existingCorsHeaders) {
            const existingValue = c.res.headers.get(corsHeader);
            if (existingValue) {
                corsHeaders[corsHeader] = existingValue;
            }
        }

        // Create response manually with proper status code and headers
        const responseBody = {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: config.message,
                reason: 'RATE_LIMIT_EXCEEDED'
            }
        };

        // Create headers object with all necessary headers
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/json');

        setRateLimitHeaders({
            target: responseHeaders,
            style: config.headers,
            limit: config.maxRequests.toString(),
            remaining: '0',
            reset: Math.floor(resetTime / 1000).toString(),
            typeTag: endpointType
        });

        // Add preserved CORS headers
        for (const [header, value] of Object.entries(corsHeaders)) {
            responseHeaders.set(header, value);
        }
        return new Response(JSON.stringify(responseBody), {
            status: 429,
            headers: responseHeaders
        });
    }

    // Update rate limit data
    await store.set(storeKey, { count: count + 1, windowStart }, config.windowMs);

    // Set rate limit headers for successful requests based on configured header style.
    setRateLimitHeaders({
        target: c,
        style: config.headers,
        limit: config.maxRequests.toString(),
        remaining: (config.maxRequests - count - 1).toString(),
        reset: Math.floor(resetTime / 1000).toString(),
        typeTag: endpointType
    });

    // Log rate limit activity for monitoring
    if (count > config.maxRequests * 0.8) {
        // Warn when approaching limit
        apiLogger.warn({
            message: `Rate limit approaching for ${endpointType} endpoint`,
            clientIp,
            path,
            endpointType,
            count: count + 1,
            limit: config.maxRequests,
            remaining: config.maxRequests - count - 1
        });
    }

    // Continue to next middleware
    await next();
};

// ─── Keyed Rate Limit Middleware ──────────────────────────────────────────────

import { createHash } from 'node:crypto';

/**
 * Options for the email-keyed (or any-key-keyed) rate limit middleware.
 *
 * @property requests - Maximum requests allowed in the window.
 * @property windowMs - Window duration in milliseconds.
 * @property keyPrefix - Unique prefix to avoid key collisions across different routes.
 * @property keyExtractor - Returns the raw key for the current request (e.g. email address).
 *   Return `null` to SKIP this limiter for the current request (IP limiter still applies upstream).
 *   The raw key is normalised with `SHA-256` before being stored, so no PII is persisted.
 */
export interface KeyedRateLimitOptions {
    readonly requests: number;
    readonly windowMs: number;
    readonly keyPrefix: string;
    readonly keyExtractor: (c: Context) => string | null;
}

/**
 * Creates a keyed rate-limit middleware that limits requests per an arbitrary
 * key extracted from the request context (e.g. the guest's email address).
 *
 * Behaviour:
 * - `keyExtractor` returns `null` → middleware is a no-op for this request.
 * - The raw key is hashed with SHA-256 before writing to the store, ensuring
 *   that email addresses (PII) are never persisted in plaintext.
 * - Final Redis/memory key: `ratelimit:{keyPrefix}:{sha256hex(rawKey)}`.
 * - On limit exceeded: returns HTTP 429 with `Retry-After` header and a JSON
 *   body containing `{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', reason: 'RATE_LIMIT_EXCEEDED' } }`.
 *
 * @param options - Rate-limit configuration.
 * @returns Hono middleware handler.
 *
 * @example
 * ```ts
 * const emailLimiter = createKeyedRateLimitMiddleware({
 *   requests: 5,
 *   windowMs: 60 * 60 * 1000, // 1 hour
 *   keyPrefix: 'conv:initiate:email',
 *   keyExtractor: (c) => (c.req.valid('json').email ?? '').toLowerCase().trim() || null,
 * });
 * ```
 */
export const createKeyedRateLimitMiddleware = (
    options: KeyedRateLimitOptions
): ((c: Context, next: Next) => Promise<Response | undefined>) => {
    const { requests, windowMs, keyPrefix, keyExtractor } = options;

    return async (c: Context, next: Next): Promise<Response | undefined> => {
        // Skip in test environment unless explicitly testing
        if (env.NODE_ENV === 'test' && !env.HOSPEDA_TESTING_RATE_LIMIT) {
            await next();
            return undefined;
        }

        // Extract the raw key; null means skip this limiter
        const rawKey = keyExtractor(c);
        if (rawKey === null) {
            await next();
            return undefined;
        }

        // Hash the raw key so PII is never stored in plaintext
        const keyHash = createHash('sha256').update(rawKey).digest('hex');
        const storeKey = `ratelimit:${keyPrefix}:${keyHash}`;

        const baseRateLimitConfig = getBaseRateLimitConfig();
        const store = getStore();
        const now = Date.now();
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const resetTime = windowStart + windowMs;

        const currentData = await store.get(storeKey);
        let count = 0;

        if (currentData && currentData.windowStart === windowStart) {
            count = currentData.count;
        }

        if (count >= requests) {
            const retryAfterSec = Math.ceil((resetTime - now) / 1000);
            const responseBody = {
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    reason: 'RATE_LIMIT_EXCEEDED'
                }
            };

            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Retry-After', retryAfterSec.toString());
            setRateLimitHeaders({
                target: headers,
                style: baseRateLimitConfig.headers,
                limit: requests.toString(),
                remaining: '0',
                reset: Math.floor(resetTime / 1000).toString(),
                typeTag: 'keyed'
            });

            return new Response(JSON.stringify(responseBody), {
                status: 429,
                headers
            });
        }

        await store.set(storeKey, { count: count + 1, windowStart }, windowMs);

        setRateLimitHeaders({
            target: c,
            style: baseRateLimitConfig.headers,
            limit: requests.toString(),
            remaining: (requests - count - 1).toString(),
            reset: Math.floor(resetTime / 1000).toString(),
            typeTag: 'keyed'
        });

        await next();
        return undefined;
    };
};

// ─── Sliding-Window Per-User Rate Limiter ─────────────────────────────────────

/**
 * Options for the per-user sliding-window rate limiter.
 *
 * @property windowMs - Width of the sliding window in milliseconds (e.g. 60_000 for 1 min).
 * @property max - Maximum number of requests allowed inside the window.
 * @property keyPrefix - Unique prefix for this limiter instance (avoids key collisions
 *   between different protected endpoints). Defaults to `"sw"`.
 */
export interface SlidingWindowPerUserOptions {
    readonly windowMs: number;
    readonly max: number;
    readonly keyPrefix?: string;
}

/**
 * In-memory store for per-user sliding-window rate limiting.
 *
 * Each value is an array of request timestamps (epoch ms) recorded during the
 * current window. Timestamps older than `windowMs` are pruned on every check so
 * the array never grows without bound during a session, and the periodic cleanup
 * sweep below removes stale keys that have had no recent activity.
 *
 * NOTE: This store is PROCESS-LOCAL. When the API runs across multiple instances
 * (e.g. multiple Coolify replicas behind a load balancer) each instance maintains
 * its own counters, so the effective per-user limit is `max * instanceCount`.
 *
 * TODO(SPEC-079-redis): Replace the in-memory backend with a Redis sorted-set
 * implementation (ZADD / ZREMRANGEBYSCORE / ZCARD) when multi-instance traffic
 * is observed. The `SlidingWindowStore` interface below is the contract for that
 * backend. Selection via `HOSPEDA_RATE_LIMIT_BACKEND=redis`.
 */
const slidingWindowMemoryStore = new Map<string, number[]>();

/** Interval in ms between cleanup sweeps of the sliding-window store. */
const SW_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

/**
 * Removes entries whose entire timestamp array is older than `maxAgeMs`.
 * Called by the periodic sweep and exported for test use.
 *
 * @param maxAgeMs - Entries untouched for longer than this are deleted.
 */
export function cleanupSlidingWindowEntries(maxAgeMs: number): void {
    const now = Date.now();
    for (const [key, timestamps] of slidingWindowMemoryStore.entries()) {
        if (timestamps.length === 0 || now - (timestamps[timestamps.length - 1] ?? 0) > maxAgeMs) {
            slidingWindowMemoryStore.delete(key);
        }
    }
}

/** Handle for the sliding-window cleanup interval (undefined in test env). */
let swCleanupInterval: ReturnType<typeof setInterval> | undefined;

// pre-validation: must use process.env directly (module-level, before validateApiEnv() runs)
if (process.env.NODE_ENV !== 'test') {
    swCleanupInterval = setInterval(
        () => cleanupSlidingWindowEntries(SW_CLEANUP_INTERVAL_MS * 10),
        SW_CLEANUP_INTERVAL_MS
    );
    swCleanupInterval.unref();
}

/**
 * Stops the sliding-window cleanup interval. Call during graceful shutdown.
 */
export function stopSlidingWindowCleanupInterval(): void {
    if (swCleanupInterval) {
        clearInterval(swCleanupInterval);
        swCleanupInterval = undefined;
    }
}

/**
 * Clears the entire sliding-window in-memory store. Useful for test isolation.
 */
export function clearSlidingWindowStore(): void {
    slidingWindowMemoryStore.clear();
}

/**
 * Abstract store contract for the sliding-window rate limiter.
 *
 * The in-memory implementation is the default. A Redis implementation using
 * sorted sets (ZADD / ZREMRANGEBYSCORE / ZCARD) satisfies this interface for
 * multi-instance deployments. Select via `HOSPEDA_RATE_LIMIT_BACKEND=redis`.
 */
export interface SlidingWindowStore {
    /**
     * Records a new request timestamp for `key` and returns the number of
     * requests recorded inside the `[now - windowMs, now]` window (after
     * pruning expired entries).
     */
    record(key: string, windowMs: number): Promise<number>;

    /**
     * Returns the number of requests recorded inside the window without
     * adding a new entry.
     */
    count(key: string, windowMs: number): Promise<number>;

    /** Returns the timestamp (ms) of the oldest request inside the window, or undefined. */
    oldestInWindow(key: string, windowMs: number): Promise<number | undefined>;
}

// ─── Redis Sliding-Window Store ───────────────────────────────────────────────

/**
 * Key prefix namespace for sliding-window sorted sets in Redis.
 * Concatenated with the caller-supplied `keyPrefix` and user identity to form
 * the full Redis key, e.g. `rl:slide:upload:protected:user-uuid`.
 */
const REDIS_SW_NAMESPACE = 'rl:slide:';

/**
 * Redis sorted-set implementation of {@link SlidingWindowStore}.
 *
 * Each key stores a sorted set where every member is a unique request token
 * (epoch-ms + random suffix to allow duplicate timestamps) and the score is
 * the request timestamp in epoch milliseconds.
 *
 * Operations performed per request (sequential individual commands):
 *   1. ZREMRANGEBYSCORE — prune entries older than the window (O(log N + M))
 *   2. ZADD             — record the new request (O(log N))
 *   3. ZCARD            — count remaining entries (O(1))
 *   4. EXPIRE           — refresh TTL (O(1))
 *
 * ### Fail-open behaviour
 * If Redis is unavailable (connection error, timeout, or `getRedisClient()`
 * returns `undefined`), every operation falls back to the in-memory store and
 * logs a warning. The rate limit is NOT enforced from Redis in that case, but
 * the API request is NEVER blocked solely because of a Redis failure.
 */
export class RedisSlidingWindowStore implements SlidingWindowStore {
    /**
     * Records a new request and returns the count within the window.
     * Uses sequential ZREMRANGEBYSCORE -> ZADD -> ZCARD -> EXPIRE commands.
     *
     * @param key - Store key (already includes keyPrefix + identity).
     * @param windowMs - Sliding window width in milliseconds.
     * @returns Number of requests in [now - windowMs, now] after recording.
     */
    async record(key: string, windowMs: number): Promise<number> {
        const redisKey = `${REDIS_SW_NAMESPACE}${key}`;
        const now = Date.now();
        const cutoff = now - windowMs;
        // TTL = window + 10 s buffer to handle clock skew
        const ttlSeconds = Math.ceil(windowMs / 1000) + 10;
        // Unique member: timestamp + 6-char random suffix prevents collision on same ms
        const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const redis = await getRedisClient();
            if (!redis) {
                apiLogger.warn(
                    { key },
                    'RedisSlidingWindowStore.record: Redis unavailable, using in-memory fallback'
                );
                return inMemorySlidingWindowStore.record(key, windowMs);
            }

            await redis.zremrangebyscore(redisKey, '-inf', cutoff);
            await redis.zadd(redisKey, now, member);
            const count = await redis.zcard(redisKey);
            await redis.expire(redisKey, ttlSeconds);

            return count;
        } catch (error) {
            apiLogger.warn(
                { error, key },
                'RedisSlidingWindowStore.record: unexpected error, using in-memory fallback'
            );
            return inMemorySlidingWindowStore.record(key, windowMs);
        }
    }

    /**
     * Returns the count of requests within the window without recording a new one.
     * Uses ZREMRANGEBYSCORE (prune expired) then ZCARD (count active).
     *
     * @param key - Store key.
     * @param windowMs - Sliding window width in milliseconds.
     * @returns Number of requests in [now - windowMs, now].
     */
    async count(key: string, windowMs: number): Promise<number> {
        const redisKey = `${REDIS_SW_NAMESPACE}${key}`;
        const now = Date.now();
        const cutoff = now - windowMs;

        try {
            const redis = await getRedisClient();
            if (!redis) {
                apiLogger.warn(
                    { key },
                    'RedisSlidingWindowStore.count: Redis unavailable, using in-memory fallback'
                );
                return inMemorySlidingWindowStore.count(key, windowMs);
            }

            await redis.zremrangebyscore(redisKey, '-inf', cutoff);
            const count = await redis.zcard(redisKey);
            return count;
        } catch (error) {
            apiLogger.warn(
                { error, key },
                'RedisSlidingWindowStore.count: unexpected error, using in-memory fallback'
            );
            return inMemorySlidingWindowStore.count(key, windowMs);
        }
    }

    /**
     * Returns the timestamp (ms) of the oldest request inside the window, or undefined.
     * Uses ZRANGEBYSCORE with LIMIT 0 1 to fetch only the lowest-score member.
     *
     * @param key - Store key.
     * @param windowMs - Sliding window width in milliseconds.
     * @returns Oldest request timestamp in ms, or undefined if no entries in window.
     */
    async oldestInWindow(key: string, windowMs: number): Promise<number | undefined> {
        const redisKey = `${REDIS_SW_NAMESPACE}${key}`;
        const now = Date.now();
        const cutoff = now - windowMs;

        try {
            const redis = await getRedisClient();
            if (!redis) {
                return inMemorySlidingWindowStore.oldestInWindow(key, windowMs);
            }

            const members = await redis.zrangebyscore(redisKey, cutoff, '+inf', 'LIMIT', 0, 1);
            if (!members || members.length === 0) {
                return undefined;
            }

            // Member format: "<timestamp>-<random>". Extract the timestamp prefix.
            const member = members[0];
            if (!member) return undefined;
            const dashIdx = member.indexOf('-');
            if (dashIdx === -1) return undefined;
            const ts = Number(member.slice(0, dashIdx));
            return Number.isFinite(ts) ? ts : undefined;
        } catch (error) {
            apiLogger.warn(
                { error, key },
                'RedisSlidingWindowStore.oldestInWindow: unexpected error, using in-memory fallback'
            );
            return inMemorySlidingWindowStore.oldestInWindow(key, windowMs);
        }
    }
}

/**
 * Singleton Redis sliding-window store instance.
 * Created lazily on first use; shared across all middleware instances that
 * select the Redis backend.
 */
let redisSlidingWindowStoreInstance: RedisSlidingWindowStore | undefined;

/**
 * Returns the singleton {@link RedisSlidingWindowStore} instance.
 * Creates it on first call.
 */
function getRedisSlidingWindowStore(): RedisSlidingWindowStore {
    if (!redisSlidingWindowStoreInstance) {
        redisSlidingWindowStoreInstance = new RedisSlidingWindowStore();
    }
    return redisSlidingWindowStoreInstance;
}

/**
 * Resets the Redis sliding-window store singleton. For testing only.
 */
export function resetRedisSlidingWindowStore(): void {
    redisSlidingWindowStoreInstance = undefined;
}

// ─── In-memory Sliding-Window Store ──────────────────────────────────────────

/** In-memory implementation of {@link SlidingWindowStore}. */
const inMemorySlidingWindowStore: SlidingWindowStore = {
    async record(key: string, windowMs: number): Promise<number> {
        const now = Date.now();
        const cutoff = now - windowMs;
        const existing = slidingWindowMemoryStore.get(key) ?? [];
        // Prune timestamps outside the window
        const pruned = existing.filter((ts) => ts > cutoff);
        pruned.push(now);
        slidingWindowMemoryStore.set(key, pruned);
        return pruned.length;
    },

    async count(key: string, windowMs: number): Promise<number> {
        const now = Date.now();
        const cutoff = now - windowMs;
        const existing = slidingWindowMemoryStore.get(key) ?? [];
        return existing.filter((ts) => ts > cutoff).length;
    },

    async oldestInWindow(key: string, windowMs: number): Promise<number | undefined> {
        const now = Date.now();
        const cutoff = now - windowMs;
        const existing = slidingWindowMemoryStore.get(key) ?? [];
        const inWindow = existing.filter((ts) => ts > cutoff);
        return inWindow[0];
    }
};

/**
 * Resolves the default {@link SlidingWindowStore} based on the env var
 * `HOSPEDA_RATE_LIMIT_BACKEND`.
 *
 * - `'redis'` → {@link RedisSlidingWindowStore} (with automatic fail-open fallback
 *   to in-memory when Redis is unavailable).
 * - `'memory'` (default) → in-process {@link inMemorySlidingWindowStore}.
 *
 * Called lazily inside `createSlidingWindowPerUserRateLimit` so that the env is
 * already validated before this runs.
 */
function resolveDefaultSlidingWindowStore(): SlidingWindowStore {
    if (env.HOSPEDA_RATE_LIMIT_BACKEND === 'redis') {
        return getRedisSlidingWindowStore();
    }
    return inMemorySlidingWindowStore;
}

/**
 * Factory that creates a Hono middleware enforcing a per-user sliding-window
 * rate limit on the decorated endpoint.
 *
 * Usage:
 * ```ts
 * import { createSlidingWindowPerUserRateLimit } from '../middlewares/rate-limit';
 *
 * export const adminUploadRoute = createAdminRoute({
 *   // ...
 *   options: {
 *     middlewares: [
 *       createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 30 })
 *     ]
 *   }
 * });
 * ```
 *
 * ### Behaviour
 * - Extracts the authenticated user ID from the Hono context via `c.get('actor')`.
 *   Falls back to the client IP when no actor is available (should not happen on
 *   authenticated endpoints, but prevents a hard crash).
 * - Returns HTTP 429 with `Retry-After` and `X-RateLimit-*` headers when the
 *   window is full.
 * - Continues normally and sets informational headers on allowed requests.
 *
 * ### Backend selection
 * When `store` is omitted the backend is selected from `HOSPEDA_RATE_LIMIT_BACKEND`:
 * - `'redis'` → {@link RedisSlidingWindowStore} with fail-open fallback to in-memory.
 * - `'memory'` (default) → process-local in-memory store.
 * Passing an explicit `store` overrides the env-based selection entirely, which is
 * useful for tests and custom backends.
 *
 * @param opts - Configuration: windowMs, max, optional keyPrefix.
 * @param store - Optional storage backend. When omitted, selected from env.
 * @returns A Hono `MiddlewareHandler`.
 */
export function createSlidingWindowPerUserRateLimit(
    opts: SlidingWindowPerUserOptions,
    store?: SlidingWindowStore
): (c: Context, next: Next) => Promise<Response | undefined> {
    // Resolve the store once at factory-creation time (not per request) so the
    // env lookup is only performed once and the same store instance is reused.
    const resolvedStore = store ?? resolveDefaultSlidingWindowStore();
    const { windowMs, max, keyPrefix = 'sw' } = opts;

    return async (c: Context, next: Next): Promise<Response | undefined> => {
        // Skip in test environment unless explicitly testing
        if (env.NODE_ENV === 'test' && !env.HOSPEDA_TESTING_RATE_LIMIT) {
            await next();
            return undefined;
        }

        // ── Extract identity ──────────────────────────────────────────────────
        // Prefer actor.id (authenticated user) so the limit is per-user, not
        // per-IP. Fall back to IP for belt-and-suspenders safety.
        const actor = c.get('actor') as { id?: string } | undefined;
        const identity =
            actor?.id && actor.id !== '00000000-0000-4000-8000-000000000000'
                ? actor.id
                : getClientIp({ c });

        const storeKey = `${keyPrefix}:${identity}`;

        // ── Check current count BEFORE recording ──────────────────────────────
        const currentCount = await resolvedStore.count(storeKey, windowMs);

        if (currentCount >= max) {
            // Calculate Retry-After from the oldest timestamp in the window
            const oldest = await resolvedStore.oldestInWindow(storeKey, windowMs);
            const retryAfterMs = oldest !== undefined ? windowMs - (Date.now() - oldest) : windowMs;
            const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
            const resetEpochSec = Math.ceil((Date.now() + retryAfterMs) / 1000);

            apiLogger.warn(
                {
                    event: 'rate_limit.exceeded',
                    identity,
                    path: c.req.path,
                    keyPrefix,
                    count: currentCount,
                    max
                },
                'Per-user sliding-window rate limit exceeded'
            );

            const responseBody = {
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.'
                }
            };

            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Retry-After', retryAfterSec.toString());
            setRateLimitHeaders({
                target: headers,
                style: getBaseRateLimitConfig().headers,
                limit: max.toString(),
                remaining: '0',
                reset: resetEpochSec.toString()
            });

            return new Response(JSON.stringify(responseBody), {
                status: 429,
                headers
            });
        }

        // ── Record request and set informational headers ──────────────────────
        const newCount = await resolvedStore.record(storeKey, windowMs);
        const remaining = Math.max(0, max - newCount);
        const resetEpochSec = Math.ceil((Date.now() + windowMs) / 1000);

        setRateLimitHeaders({
            target: c,
            style: getBaseRateLimitConfig().headers,
            limit: max.toString(),
            remaining: remaining.toString(),
            reset: resetEpochSec.toString()
        });

        await next();
        return undefined;
    };
}
