/**
 * Security middleware using Hono's built-in secure headers plugin
 * Applies security headers to all requests based on environment configuration
 */
import type { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { env, getCorsConfig, getSecurityConfig } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Security headers middleware that applies consistent security headers
 *
 * Features:
 * - Respects environment configuration
 * - Applies permissive CSP for documentation routes (/docs) while preserving other headers
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
        env.NODE_ENV === 'production' || (securityConfig.enabled && securityConfig.headersEnabled);

    if (!shouldApplyHeaders) {
        await next();
        return;
    }

    // Shared non-CSP security headers applied to all routes including /docs
    const commonHeaders = {
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
    } as const;

    // Documentation routes get a permissive CSP for Swagger/Scalar UI
    // but still receive HSTS, X-Frame-Options, X-Content-Type-Options, etc.
    if (c.req.path.startsWith('/docs')) {
        const docsMiddleware = secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://cdn.jsdelivr.net',
                    'https://unpkg.com'
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://cdn.jsdelivr.net',
                    'https://unpkg.com'
                ],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: [
                    "'self'",
                    'data:',
                    'https://fonts.scalar.com',
                    'https://fonts.googleapis.com',
                    'https://fonts.gstatic.com'
                ],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: []
            },
            ...commonHeaders
        });

        await docsMiddleware(c, next);
        return;
    }

    // Non-docs routes get strict CSP. No inline scripts/styles needed for JSON responses.
    const strictMiddleware = secureHeaders({
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        },
        ...commonHeaders
    });

    await strictMiddleware(c, next);
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
    if (env.NODE_ENV === 'test' && !env.HOSPEDA_TESTING_ORIGIN_VERIFICATION) {
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
