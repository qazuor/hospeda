import { logger } from '@repo/logger';
import type { MiddlewareHandler } from 'hono';
import { rateLimiter as honoRateLimiter } from 'hono-rate-limiter';
import { env } from '../utils/env';
/**
 * Advanced rate limiting middleware using hono-rate-limiter
 * Provides flexible rate limiting with different strategies
 */

/**
 * Rate limiting configuration by endpoint type
 */
const RATE_LIMIT_CONFIG = {
    // General API endpoints
    default: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_REQUESTS
    },
    // Search endpoints (more restrictive)
    search: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        limit: 30
    },
    // Admin endpoints (more permissive for authenticated users)
    admin: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_REQUESTS * 2
    },
    // Authentication endpoints
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 10
    }
};

/**
 * Create rate limiter middleware with enhanced configuration
 * @returns {MiddlewareHandler} Rate limiting middleware
 */
export const rateLimiter = (): MiddlewareHandler => {
    return honoRateLimiter({
        windowMs: RATE_LIMIT_CONFIG.default.windowMs,
        limit: RATE_LIMIT_CONFIG.default.limit,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(RATE_LIMIT_CONFIG.default.windowMs / 1000)
            }
        },
        standardHeaders: true,

        /**
         * Generate unique key for rate limiting
         * Combines IP address with endpoint path for granular control
         */
        keyGenerator: (c) => {
            const clientIP =
                c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
            const endpoint = c.req.path;
            const userId = c.get('userId'); // If authenticated

            // Use user ID for authenticated requests, IP for anonymous
            const identifier = userId || clientIP;
            return `${identifier}:${endpoint}`;
        },

        /**
         * Custom handler for rate limit exceeded
         */
        handler: (c) => {
            logger.warn(`Rate limit exceeded for ${c.req.path}`);
            logger.warn(
                `IP: ${c.req.header('x-forwarded-for') || 'unknown'} | User-Agent: ${c.req.header('user-agent') || 'unknown'} | Time: ${new Date().toISOString()}`
            );

            return c.json(
                {
                    success: false,
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests. Please try again later.'
                    }
                },
                429
            );
        }
    });
};
