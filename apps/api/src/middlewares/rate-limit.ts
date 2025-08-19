/**
 * Rate limiting middleware with differentiated limits per endpoint type
 * Implements different rate limits for auth, public, admin, and general endpoints
 */
import type { Context, Next } from 'hono';
import { getRateLimitConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Clears the rate limit store (useful for testing)
 */
export const clearRateLimitStore = () => {
    rateLimitStore.clear();
};

/**
 * Determines the endpoint type based on the request path
 * @param path - The request path
 * @returns The endpoint type for rate limiting configuration
 */
const getEndpointType = (path: string): 'auth' | 'public' | 'admin' | 'general' => {
    if (path.includes('/auth/')) {
        return 'auth';
    }
    if (path.includes('/admin/')) {
        return 'admin';
    }
    if (path.includes('/public/')) {
        return 'public';
    }
    return 'general';
};

/**
 * Rate limiting middleware with environment-based configuration
 * @returns Configured rate limiting middleware
 */
export const rateLimitMiddleware = async (c: Context, next: Next) => {
    // ✅ Skip rate limiting in test environment UNLESS explicitly testing it
    if (process.env.NODE_ENV === 'test' && !process.env.TESTING_RATE_LIMIT) {
        await next();
        return;
    }

    const path = c.req.path;
    const endpointType = getEndpointType(path);
    const config = getRateLimitConfig(endpointType);

    // Skip if rate limiting is disabled for this endpoint type
    if (!config.enabled) {
        await next();
        return;
    }

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
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const resetTime = windowStart + config.windowMs;

    // Get current rate limit data
    const currentData = rateLimitStore.get(clientIp);
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
    rateLimitStore.set(clientIp, { count: count + 1, windowStart });

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
