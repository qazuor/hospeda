/**
 * Rate limiting middleware with differentiated limits per endpoint type.
 * Uses Redis when available for multi-instance support, falls back to in-memory Map.
 */
import type { Context, Next } from 'hono';
import { env, getRateLimitConfig as getBaseRateLimitConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';

/** Rate limit entry stored in-memory or serialized to Redis */
interface RateLimitEntry {
    readonly count: number;
    readonly windowStart: number;
}

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
 * Extracts the real client IP from the request, respecting proxy trust configuration.
 *
 * When trustProxy is true, checks headers in order: cf-connecting-ip, x-forwarded-for (first), x-real-ip.
 * When trustProxy is false, returns 'untrusted-proxy' so all requests share a single bucket.
 *
 * @param params - Object containing the Hono context
 * @returns The client IP string
 */
export const getClientIp = ({ c }: { c: Context }): string => {
    const baseRateLimitConfig = getBaseRateLimitConfig();
    const trustProxy = baseRateLimitConfig.trustProxy;

    if (!trustProxy) {
        // When proxy is not trusted, use the socket remote address instead of
        // a shared bucket so each real client gets its own rate limit window.
        // NOTE: trustProxy=true should only be enabled behind Vercel/Cloudflare.
        const socketIp =
            c.req.raw && 'socket' in c.req.raw
                ? (c.req.raw as { socket?: { remoteAddress?: string } }).socket?.remoteAddress
                : undefined;
        return socketIp ?? 'unknown';
    }

    const cfConnectingIp = c.req.header('cf-connecting-ip');
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    const forwardedFor = c.req.header('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = c.req.header('x-real-ip');
    if (realIp) {
        return realIp;
    }

    return 'unknown';
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

        const clientIp = getClientIp({ c });
        const path = c.req.path;
        const store = getStore();
        const now = Date.now();
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const resetTime = windowStart + windowMs;

        // Use a distinct key prefix for per-route limits
        const storeKey = `route:${path}:${clientIp}`;

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
                    message: 'Too many requests to this endpoint. Please try again later.'
                }
            };

            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', 'application/json');
            responseHeaders.set('X-RateLimit-Limit', requests.toString());
            responseHeaders.set('X-RateLimit-Remaining', '0');
            responseHeaders.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
            responseHeaders.set('X-RateLimit-Type', 'per-route');
            responseHeaders.set('Retry-After', Math.ceil((resetTime - now) / 1000).toString());

            return new Response(JSON.stringify(responseBody), {
                status: 429,
                headers: responseHeaders
            });
        }

        await store.set(storeKey, { count: count + 1, windowStart }, windowMs);

        c.header('X-RateLimit-Limit', requests.toString());
        c.header('X-RateLimit-Remaining', (requests - count - 1).toString());
        c.header('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
        c.header('X-RateLimit-Type', 'per-route');

        await next();
    };
};

/** Supported rate limit endpoint categories */
type RateLimitEndpointType = 'auth' | 'public' | 'admin' | 'billing' | 'webhook' | 'general';

/**
 * Determines the endpoint type based on the request path and method.
 *
 * The order matters: more specific categories (billing, webhook) are checked
 * before broader ones (admin, public) so that a POST to a billing path under
 * `/admin/` still gets the restrictive billing limits.
 *
 * @param path - The request path
 * @param method - The HTTP method (uppercase)
 * @returns The endpoint type for rate limiting configuration
 */
const getEndpointType = (path: string, method: string): RateLimitEndpointType => {
    // Webhook endpoints get their own high-throughput bucket
    if (path.includes('/webhooks/') || path.includes('/webhook/')) {
        return 'webhook';
    }
    // Financial POST operations on billing paths get restrictive limits
    if (path.includes('/billing/') && method === 'POST') {
        return 'billing';
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
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
            };
        case 'public':
            return {
                enabled: baseConfig.publicEnabled,
                windowMs: baseConfig.publicWindowMs,
                maxRequests: baseConfig.publicMaxRequests,
                message: baseConfig.publicMessage,
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
            };
        case 'admin':
            return {
                enabled: baseConfig.adminEnabled,
                windowMs: baseConfig.adminWindowMs,
                maxRequests: baseConfig.adminMaxRequests,
                message: baseConfig.adminMessage,
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
            };
        case 'billing':
            return {
                enabled: baseConfig.billingEnabled,
                windowMs: baseConfig.billingWindowMs,
                maxRequests: baseConfig.billingMaxRequests,
                message: baseConfig.billingMessage,
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
            };
        case 'webhook':
            return {
                enabled: baseConfig.webhookEnabled,
                windowMs: baseConfig.webhookWindowMs,
                maxRequests: baseConfig.webhookMaxRequests,
                message: baseConfig.webhookMessage,
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
            };
        default:
            return {
                enabled: baseConfig.enabled,
                windowMs: baseConfig.windowMs,
                maxRequests: baseConfig.maxRequests,
                message: baseConfig.message,
                standardHeaders: baseConfig.standardHeaders,
                legacyHeaders: baseConfig.legacyHeaders
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

    // Warn once when proxy is not trusted
    if (clientIp === 'untrusted-proxy') {
        const store = getStore();
        const warningLogged = await store.has('__proxy_warning_logged__');
        if (!warningLogged) {
            apiLogger.warn(
                'Rate limiting: API_RATE_LIMIT_TRUST_PROXY is false. ' +
                    'All requests share one rate limit bucket. ' +
                    'Set to true when behind a trusted reverse proxy (Vercel, Cloudflare, etc.)'
            );
            await store.set(
                '__proxy_warning_logged__',
                { count: 1, windowStart: Date.now() },
                config.windowMs
            );
        }
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
                message: config.message
            }
        };

        // Create headers object with all necessary headers
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/json');

        // Add rate limit headers
        if (config.standardHeaders) {
            responseHeaders.set('X-RateLimit-Limit', config.maxRequests.toString());
            responseHeaders.set('X-RateLimit-Remaining', '0');
            responseHeaders.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
            responseHeaders.set('X-RateLimit-Type', endpointType); // Add endpoint type for debugging
        }

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

    // Set rate limit headers for successful requests
    if (config.standardHeaders) {
        c.header('X-RateLimit-Limit', config.maxRequests.toString());
        c.header('X-RateLimit-Remaining', (config.maxRequests - count - 1).toString());
        c.header('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
        c.header('X-RateLimit-Type', endpointType); // Add endpoint type for debugging
    }

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
