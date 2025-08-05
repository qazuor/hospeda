/**
 * Rate limiting middleware using hono-rate-limiter
 * Limits the number of requests per IP address or user
 */
import { env } from '../utils/env';

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Clears the rate limit store (useful for testing)
 */
export const clearRateLimitStore = () => {
    rateLimitStore.clear();
};

/**
 * Creates rate limiting middleware with environment-based configuration
 * @returns Configured rate limiting middleware
 */
export const createRateLimitMiddleware = () => {
    // Skip rate limiting if disabled
    if (!env.RATE_LIMIT_ENABLED) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    return async (
        // biome-ignore lint/suspicious/noExplicitAny: Hono context type
        c: any,
        // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
        next: any
    ) => {
        // Get client IP
        const forwardedFor = c.req.header('x-forwarded-for');
        const realIp = c.req.header('x-real-ip');
        const cfConnectingIp = c.req.header('cf-connecting-ip');

        let clientIp = 'unknown';
        if (forwardedFor) {
            clientIp = forwardedFor.split(',')[0].trim();
        } else if (realIp) {
            clientIp = realIp;
        } else if (cfConnectingIp) {
            clientIp = cfConnectingIp;
        }

        const now = Date.now();
        const windowStart = Math.floor(now / env.RATE_LIMIT_WINDOW_MS) * env.RATE_LIMIT_WINDOW_MS;
        const resetTime = windowStart + env.RATE_LIMIT_WINDOW_MS;

        // Get current rate limit data
        const currentData = rateLimitStore.get(clientIp);
        let count = 0;

        if (currentData && currentData.windowStart === windowStart) {
            // Still in the same window
            count = currentData.count;
        }

        // Check if rate limit exceeded
        if (count >= env.RATE_LIMIT_MAX_REQUESTS) {
            // Set rate limit headers
            if (env.RATE_LIMIT_STANDARD_HEADERS) {
                c.header('X-RateLimit-Limit', env.RATE_LIMIT_MAX_REQUESTS.toString());
                c.header('X-RateLimit-Remaining', '0');
                c.header('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
            }

            return c.json(
                {
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: env.RATE_LIMIT_MESSAGE
                    }
                },
                429
            );
        }

        // Update rate limit data
        rateLimitStore.set(clientIp, { count: count + 1, windowStart });

        // Set rate limit headers for successful requests
        if (env.RATE_LIMIT_STANDARD_HEADERS) {
            c.header('X-RateLimit-Limit', env.RATE_LIMIT_MAX_REQUESTS.toString());
            c.header('X-RateLimit-Remaining', (env.RATE_LIMIT_MAX_REQUESTS - count - 1).toString());
            c.header('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
        }

        // Continue to next middleware
        await next();
    };
};

/**
 * Default rate limiting middleware instance
 * Uses environment-based configuration
 */
export const rateLimitMiddleware = createRateLimitMiddleware();
