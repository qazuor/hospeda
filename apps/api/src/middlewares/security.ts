/**
 * Security middleware using Hono's built-in secure headers plugin
 * Applies security headers to all requests based on environment configuration
 */
import type { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { getSecurityConfig } from '../utils/env';

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
