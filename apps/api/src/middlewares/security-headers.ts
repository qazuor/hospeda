import { logger } from '@repo/logger';
import type { MiddlewareHandler } from 'hono';

/**
 * Security Headers Configuration
 * Comprehensive security headers for production environments
 */
const SECURITY_HEADERS = {
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',

    // Content Type Options - Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',

    // Frame Options - Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Referrer Policy - Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy - Control browser features
    'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'interest-cohort=()',
        'payment=()',
        'autoplay=(self)',
        'fullscreen=(self)'
    ].join(', '),

    // Content Security Policy - XSS and data injection protection
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net",
        "img-src 'self' data: https:",
        "font-src 'self' data: cdn.jsdelivr.net",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests'
    ].join('; '),

    // HTTP Strict Transport Security - Force HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // Cross-Origin Policies - Relaxed for development
    'Cross-Origin-Embedder-Policy': 'unsafe-none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin'
} as const;

/**
 * Development-friendly security headers
 * Relaxed CSP for development environments
 */
const DEV_SECURITY_HEADERS = {
    ...SECURITY_HEADERS,
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* 127.0.0.1:* cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net",
        "img-src 'self' data: https: localhost:* 127.0.0.1:*",
        "font-src 'self' data: cdn.jsdelivr.net",
        "connect-src 'self' localhost:* 127.0.0.1:* ws: wss:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ')
} as const;

/**
 * Security headers middleware
 * Applies comprehensive security headers based on environment
 *
 * @param options - Configuration options
 * @returns {MiddlewareHandler} Security headers middleware
 */
interface SecurityHeadersOptions {
    /** Whether to use development-friendly headers */
    development?: boolean;
    /** Custom headers to add or override */
    customHeaders?: Record<string, string>;
    /** Headers to exclude */
    excludeHeaders?: string[];
    /** Enable detailed logging */
    enableLogging?: boolean;
}

export const securityHeaders = (options: SecurityHeadersOptions = {}): MiddlewareHandler => {
    const {
        development = false,
        customHeaders = {},
        excludeHeaders = [],
        enableLogging = false
    } = options;

    // Choose appropriate header set based on environment
    const baseHeaders = development ? DEV_SECURITY_HEADERS : SECURITY_HEADERS;

    // Filter out excluded headers
    const filteredHeaders = Object.entries(baseHeaders).reduce(
        (acc, [key, value]) => {
            if (!excludeHeaders.includes(key)) {
                acc[key] = value;
            }
            return acc;
        },
        {} as Record<string, string>
    );

    // Merge with custom headers (custom headers take precedence)
    const finalHeaders = {
        ...filteredHeaders,
        ...customHeaders
    };

    return async (c, next) => {
        // Apply security headers
        for (const [header, value] of Object.entries(finalHeaders)) {
            c.header(header, value);
        }

        // Log security headers application if enabled
        if (enableLogging) {
            logger.debug(
                `Security headers applied to ${c.req.path} - ${Object.keys(finalHeaders).length} headers - dev: ${development}`
            );
        }

        await next();
    };
};

/**
 * Predefined security header configurations
 */

/**
 * Strict security headers for production APIs
 */
export const strictSecurityHeaders = () =>
    securityHeaders({
        development: false,
        enableLogging: true,
        customHeaders: {
            'X-API-Version': '1.0',
            'X-Powered-By': 'Hono'
        }
    });

/**
 * Development-friendly security headers
 */
export const devSecurityHeaders = () =>
    securityHeaders({
        development: true,
        enableLogging: true,
        excludeHeaders: ['Strict-Transport-Security'] // Don't force HTTPS in dev
    });

/**
 * API-specific security headers
 */
export const apiSecurityHeaders = () =>
    securityHeaders({
        development: process.env.NODE_ENV === 'development',
        customHeaders: {
            'X-Content-Type-Options': 'nosniff',
            'X-API-Rate-Limit': 'true',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        },
        excludeHeaders: [
            'X-Frame-Options', // Not needed for API endpoints
            'Cross-Origin-Embedder-Policy' // Can interfere with API usage
        ],
        enableLogging: true
    });
