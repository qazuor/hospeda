/**
 * Security middleware using Hono's built-in plugins
 * Combines CSRF protection and secure headers
 */
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '../utils/env';

/**
 * Creates CSRF middleware with environment-based configuration
 * @returns Configured CSRF middleware
 */
export const createCsrfMiddleware = () => {
    // Skip CSRF if disabled
    if (!env.SECURITY_ENABLED || !env.SECURITY_CSRF_ENABLED) {
        return async (
            // biome-ignore lint/suspicious/noExplicitAny: Hono context type
            _c: any,
            // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
            next: any
        ) => {
            await next();
        };
    }

    // Parse origins from environment
    const origins = env.SECURITY_CSRF_ORIGINS.split(',').map((origin) => origin.trim());

    return csrf({
        origin: origins.length === 1 ? origins[0] : origins
    });
};

/**
 * Creates secure headers middleware with environment-based configuration
 * @returns Configured secure headers middleware
 */
export const createSecureHeadersMiddleware = () => {
    // Skip secure headers if disabled
    if (!env.SECURITY_ENABLED || !env.SECURITY_HEADERS_ENABLED) {
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
        // Skip security headers for documentation routes
        if (
            c.req.path.startsWith('/docs') ||
            c.req.path.startsWith('/reference') ||
            c.req.path.startsWith('/ui')
        ) {
            await next();
            return;
        }

        // Apply secure headers for other routes
        const secureHeadersMiddleware = secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https:', 'data:'],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"]
            },
            strictTransportSecurity: env.SECURITY_STRICT_TRANSPORT_SECURITY,
            xFrameOptions: env.SECURITY_X_FRAME_OPTIONS,
            xContentTypeOptions: env.SECURITY_X_CONTENT_TYPE_OPTIONS,
            xXssProtection: env.SECURITY_X_XSS_PROTECTION,
            referrerPolicy: env.SECURITY_REFERRER_POLICY,
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
};

/**
 * Combined security middleware
 * Applies both CSRF protection and secure headers
 */
export const createSecurityMiddleware = () => {
    const csrfMiddleware = createCsrfMiddleware();
    const secureHeadersMiddleware = createSecureHeadersMiddleware();

    return async (
        // biome-ignore lint/suspicious/noExplicitAny: Hono context type
        c: any,
        // biome-ignore lint/suspicious/noExplicitAny: Hono next function type
        next: any
    ) => {
        // Skip security middleware for documentation routes
        if (
            c.req.path.startsWith('/docs') ||
            c.req.path.startsWith('/reference') ||
            c.req.path.startsWith('/ui')
        ) {
            await next();
            return;
        }

        // Create a wrapper for the next middleware in the chain
        const wrappedNext = async () => {
            // Apply CSRF protection after secure headers
            await csrfMiddleware(c, next);
        };

        // Apply secure headers first, then continue with CSRF
        await secureHeadersMiddleware(c, wrappedNext);
    };
};

/**
 * Default security middleware instance
 * Uses environment-based configuration
 */
export const securityHeadersMiddleware = createSecurityMiddleware();
