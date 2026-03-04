/**
 * Security middleware using Hono's built-in secure headers plugin
 * Applies security headers to all requests based on environment configuration
 */
import type { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { getCorsConfig, getSecurityConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Security headers middleware that applies consistent security headers
 *
 * Features:
 * - Respects environment configuration
 * - Skips headers for documentation routes (/docs, /reference, /ui)
 * - Uses environment-specific security policies
 * - Always enabled in production for safety
 *
 * @returns Configured secure headers middleware
 */
export const securityHeadersMiddleware = async (c: Context, next: Next) => {
    // const path = c.req.path; // Available for future use
    // const requestId = c.get('requestId') || 'unknown'; // Available for future use

    // Get security configuration
    const securityConfig = getSecurityConfig();

    // In production, always apply security headers for safety
    // In other environments, respect the configuration
    const shouldApplyHeaders =
        process.env.NODE_ENV === 'production' ||
        (securityConfig.enabled && securityConfig.headersEnabled);

    if (!shouldApplyHeaders) {
        await next();
        return;
    }

    // Skip security headers for documentation routes
    // These routes may need different CSP settings for UI functionality
    if (c.req.path.startsWith('/docs')) {
        await next();
        return;
    }

    // Apply secure headers with environment-based configuration
    // CSP is strict for API routes - no inline scripts/styles needed for JSON responses
    const secureHeadersMiddleware = secureHeaders({
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            // No 'unsafe-inline' for scripts - prevents XSS attacks
            // API routes return JSON, not HTML with scripts
            scriptSrc: ["'self'"],
            // No 'unsafe-inline' for styles - API responses don't need inline styles
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"], // Changed from 'self' to 'none' for better security
            // Explicitly block inline scripts and eval
            baseUri: ["'self'"],
            formAction: ["'self'"]
        },
        strictTransportSecurity: securityConfig.strictTransportSecurity,
        xFrameOptions: securityConfig.xFrameOptions,
        xContentTypeOptions: securityConfig.xContentTypeOptions,
        xXssProtection: securityConfig.xXssProtection,
        referrerPolicy: securityConfig.referrerPolicy,
        permissionsPolicy: {
            camera: false,
            microphone: false,
            geolocation: false,
            payment: false,
            usb: false,
            magnetometer: false,
            gyroscope: false,
            accelerometer: false
        }
    });

    await secureHeadersMiddleware(c, next);
};

/**
 * Origin verification middleware for CSRF-like protection on mutating requests.
 *
 * For REST APIs using Bearer token authentication, traditional CSRF protection
 * is not strictly necessary since:
 * 1. Bearer tokens must be explicitly sent (unlike cookies)
 * 2. CORS prevents cross-origin requests from unauthorized domains
 *
 * This middleware adds defense-in-depth by verifying that the Origin or Referer
 * header matches allowed origins for mutating HTTP methods.
 *
 * @returns Configured origin verification middleware
 */
export const originVerificationMiddleware = async (c: Context, next: Next) => {
    const method = c.req.method.toUpperCase();
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    // Only check mutating methods
    if (!mutatingMethods.includes(method)) {
        await next();
        return;
    }

    // Skip in test environment unless explicitly testing
    if (process.env.NODE_ENV === 'test' && !process.env.TESTING_ORIGIN_VERIFICATION) {
        await next();
        return;
    }

    // Get security configuration
    const securityConfig = getSecurityConfig();
    if (!securityConfig.enabled) {
        await next();
        return;
    }

    // Get allowed origins from CORS config
    const corsConfig = getCorsConfig();
    const allowedOrigins = corsConfig.origins;

    // Get Origin or Referer header
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');

    // Extract origin from referer if origin header is not present
    let requestOrigin = origin;
    if (!requestOrigin && referer) {
        try {
            const refererUrl = new URL(referer);
            requestOrigin = refererUrl.origin;
        } catch {
            // Invalid referer URL
        }
    }

    // Allow requests without origin (same-origin requests from non-browser clients)
    // Browser requests always include Origin for cross-origin requests
    if (!requestOrigin) {
        await next();
        return;
    }

    // Check if origin is allowed
    const isAllowed =
        allowedOrigins.includes('*') ||
        allowedOrigins.some((allowed) => {
            if (allowed === requestOrigin) return true;
            // Support wildcard subdomains (e.g., *.example.com)
            // Must check for leading dot to prevent sibling domain matching
            // (e.g., evil-example.com should NOT match *.example.com)
            if (allowed.startsWith('*.')) {
                const baseDomain = allowed.slice(1); // Keep the leading dot: ".example.com"
                return requestOrigin?.endsWith(baseDomain) ?? false;
            }
            return false;
        });

    if (!isAllowed) {
        apiLogger.warn({
            message: 'Origin verification failed',
            origin: requestOrigin,
            method,
            path: c.req.path,
            allowedOrigins
        });

        return c.json(
            {
                success: false,
                error: {
                    code: 'ORIGIN_NOT_ALLOWED',
                    message: 'Request origin is not allowed'
                }
            },
            403
        );
    }

    await next();
};
