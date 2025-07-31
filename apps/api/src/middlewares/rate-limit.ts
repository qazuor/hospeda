/**
 * Rate limiting middleware using hono-rate-limiter
 * Limits the number of requests per IP address or user
 */
import { rateLimiter } from 'hono-rate-limiter';
import { env } from '../utils/env';

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

    return rateLimiter({
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_MAX_REQUESTS,
        keyGenerator: (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            c: any
        ) => {
            // Try to get real IP from various headers
            const forwardedFor = c.req.header('x-forwarded-for');
            const realIp = c.req.header('x-real-ip');
            const cfConnectingIp = c.req.header('cf-connecting-ip');

            if (forwardedFor) {
                // x-forwarded-for can contain multiple IPs, take the first one
                return forwardedFor.split(',')[0].trim();
            }
            if (realIp) {
                return realIp;
            }
            if (cfConnectingIp) {
                return cfConnectingIp;
            }

            return 'unknown';
        },
        // biome-ignore lint/suspicious/noExplicitAny: Hono rate limiter types
        handler: (c: any) => {
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
    });
};

/**
 * Default rate limiting middleware instance
 * Uses environment-based configuration
 */
export const rateLimitMiddleware = createRateLimitMiddleware();
