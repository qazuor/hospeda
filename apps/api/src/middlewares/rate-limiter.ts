import type { Context, MiddlewareHandler } from 'hono';
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
        limit: env.RATE_LIMIT_REQUESTS,
        message: 'Too many requests. Please try again later.'
    },
    // Search endpoints (more restrictive)
    search: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        limit: 30,
        message: 'Search rate limit exceeded. Please wait before searching again.'
    },
    // Admin endpoints (more permissive for authenticated users)
    admin: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_REQUESTS * 3, // 3x more permissive
        message: 'Admin rate limit exceeded. Please wait before continuing.'
    },
    // Authentication endpoints (very restrictive)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 10,
        message: 'Authentication rate limit exceeded. Please wait before trying again.'
    },
    // Public endpoints (moderate)
    public: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_REQUESTS,
        message: 'Public API rate limit exceeded. Please wait before making more requests.'
    }
} as const;

/**
 * Enhanced key generator for rate limiting
 * Uses IP + User-Agent for better fingerprinting
 */
const keyGenerator = (c: Context): string => {
    const ip =
        c.req.header('CF-Connecting-IP') ||
        c.req.header('X-Forwarded-For') ||
        c.req.header('X-Real-IP') ||
        'unknown';

    const userAgent = c.req.header('User-Agent') || 'unknown';
    const userId = c.get('userId') || 'anonymous';

    // Create composite key for better rate limiting
    const baseKey = `${ip}-${userAgent.slice(0, 50)}`;

    // If user is authenticated, use user ID for more accurate limiting
    return userId !== 'anonymous' ? `user:${userId}` : `ip:${baseKey}`;
};

/**
 * Create rate limiter middleware with enhanced configuration
 * @param type - Type of rate limiting to apply
 * @returns {MiddlewareHandler} Rate limiting middleware
 */
export const rateLimiter = (
    type: keyof typeof RATE_LIMIT_CONFIG = 'default'
): MiddlewareHandler => {
    const config = RATE_LIMIT_CONFIG[type];

    return honoRateLimiter({
        windowMs: config.windowMs,
        limit: config.limit,
        keyGenerator,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: config.message,
                retryAfter: Math.ceil(config.windowMs / 1000),
                limit: config.limit,
                windowMs: config.windowMs
            }
        },
        standardHeaders: true // Add standard rate limiting headers
    });
};

/**
 * Specific rate limiters for different endpoint types
 */
export const searchRateLimiter = () => rateLimiter('search');
export const adminRateLimiter = () => rateLimiter('admin');
export const authRateLimiter = () => rateLimiter('auth');
export const publicRateLimiter = () => rateLimiter('public');
