/**
 * Rate limiting middleware using hono-rate-limiter
 * Limits the number of requests per IP address or user
 */
import type { Context, Next } from 'hono';
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
    // ✅ Skip rate limiting in test environment UNLESS explicitly testing it
    if (
        !env.RATE_LIMIT_ENABLED ||
        (process.env.NODE_ENV === 'test' && !process.env.TESTING_RATE_LIMIT)
    ) {
        return async (_c: Context, next: Next) => {
            await next();
        };
    }

    return async (c: Context, next: Next) => {
        // Get client IP
        const forwardedFor = c.req.header('x-forwarded-for');
        const realIp = c.req.header('x-real-ip');
        const cfConnectingIp = c.req.header('cf-connecting-ip');

        let clientIp = 'unknown';
        if (forwardedFor) {
            clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
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
 * ✅ DYNAMIC: Evaluates NODE_ENV on each request to respect test environment
 */
export const rateLimitMiddleware = async (c: Context, next: Next) => {
    // Skip in test environment UNLESS rate limiting is explicitly being tested
    // (detected by the test file name or explicit environment variable)
    if (process.env.NODE_ENV === 'test' && !process.env.TESTING_RATE_LIMIT) {
        await next();
        return;
    }

    // Use the configured middleware for non-test environments or when explicitly testing
    const middleware = createRateLimitMiddleware();
    await middleware(c, next);
};
