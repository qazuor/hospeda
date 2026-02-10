/**
 * Sentry Middleware for Hono
 *
 * Integrates Sentry error tracking and performance monitoring into the Hono request pipeline.
 * Automatically captures errors and tracks request performance.
 *
 * @module middlewares/sentry
 */

import type { Context, Next } from 'hono';
import { Sentry, setUserFromContext } from '../lib/sentry';
import { apiLogger } from '../utils/logger';

/**
 * Sentry middleware for error tracking and performance monitoring
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - Request context enrichment
 * - User context tracking
 *
 * @returns Hono middleware
 */
export function sentryMiddleware() {
    return async (c: Context, next: Next) => {
        // Skip if Sentry is not enabled
        if (!Sentry.isEnabled()) {
            return next();
        }

        const requestPath = c.req.path;
        const requestMethod = c.req.method;

        // Add request context
        Sentry.setContext('request', {
            method: requestMethod,
            url: requestPath,
            query: c.req.query(),
            headers: sanitizeHeaders(c.req.header())
        });

        // Add request ID if available
        const requestId = c.get('requestId');
        if (requestId) {
            Sentry.setTag('request_id', requestId);
        }

        // Set user context from auth
        setUserFromContext(c);

        try {
            // Process request
            await next();
        } catch (error) {
            // Capture error in Sentry
            Sentry.captureException(error, {
                contexts: {
                    response: {
                        status: c.res.status
                    }
                }
            });

            // Log error
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : String(error),
                    path: requestPath,
                    method: requestMethod
                },
                'Request error caught by Sentry middleware'
            );

            // Re-throw to let error handler deal with it
            throw error;
        }
    };
}

/**
 * Sanitize request headers to remove sensitive data
 *
 * @param headers - Request headers
 * @returns Sanitized headers
 */
function sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
            // Redact sensitive headers
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        }
    }

    return sanitized;
}

/**
 * Middleware to track billing route performance
 *
 * Adds additional context for billing-specific routes.
 *
 * @returns Hono middleware
 */
export function sentryBillingMiddleware() {
    return async (c: Context, next: Next) => {
        // Skip if Sentry is not enabled
        if (!Sentry.isEnabled()) {
            return next();
        }

        // Add billing-specific tags
        Sentry.setTag('module', 'billing');

        // Add billing route context
        const path = c.req.path;
        if (path.includes('/subscriptions')) {
            Sentry.setTag('billing_operation', 'subscription');
        } else if (path.includes('/payments')) {
            Sentry.setTag('billing_operation', 'payment');
        } else if (path.includes('/addons')) {
            Sentry.setTag('billing_operation', 'addon');
        } else if (path.includes('/promo-codes')) {
            Sentry.setTag('billing_operation', 'promo_code');
        } else if (path.includes('/trial')) {
            Sentry.setTag('billing_operation', 'trial');
        }

        await next();
    };
}
