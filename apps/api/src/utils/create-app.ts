import type { Context, MiddlewareHandler, Schema } from 'hono';

import { OpenAPIHono } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { actorMiddleware } from '../middlewares/actor';
import { authMiddleware } from '../middlewares/auth';
import { billingMiddleware } from '../middlewares/billing';
import { billingCustomerMiddleware } from '../middlewares/billing-customer';
import { cacheMiddleware } from '../middlewares/cache';
import { compressionMiddleware } from '../middlewares/compression';
import { corsMiddleware } from '../middlewares/cors';
import { entitlementMiddleware } from '../middlewares/entitlement';
import { loggerMiddleware } from '../middlewares/logger';
import { metricsMiddleware } from '../middlewares/metrics';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import { createErrorHandler, responseFormattingMiddleware } from '../middlewares/response';
import { responseValidatorMiddleware } from '../middlewares/response-validator';
import { originVerificationMiddleware, securityHeadersMiddleware } from '../middlewares/security';
import { sentryMiddleware } from '../middlewares/sentry';
import { trialMiddleware } from '../middlewares/trial';
import { validationMiddleware } from '../middlewares/validation';
import type { AppBindings, AppMiddleware, AppOpenAPI } from '../types';
import { transformZodError } from './zod-error-transformer';

// Lazy-loaded mock auth middleware for testing (avoids top-level await for CJS compat)
let mockAuthMiddlewareCache: MiddlewareHandler<AppBindings> | null = null;
let mockAuthLoaded = false;

/**
 * Middleware that lazily loads and delegates to mock auth in test environments.
 * No-ops in non-test environments.
 */
const lazyMockAuthMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
    // NODE_ENV is a system variable safe to read directly from process.env
    if (process.env.NODE_ENV !== 'test') {
        await next();
        return;
    }
    if (!mockAuthLoaded) {
        mockAuthMiddlewareCache = (await import('../../test/helpers/mockAuthMiddleware'))
            .mockAuthMiddleware;
        mockAuthLoaded = true;
    }
    if (mockAuthMiddlewareCache) {
        await mockAuthMiddlewareCache(c, next);
    } else {
        await next();
    }
};

// Strongly typed middleware functions
const serveEmojiFavicon =
    (emoji: string): MiddlewareHandler<AppBindings> =>
    async (c, next) => {
        if (c.req.path === '/favicon.ico') {
            return new Response(emoji, {
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        }
        await next();
    };

const notFound = async (c: Context<AppBindings>) => {
    return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } },
        404
    );
};

// Type-safe middleware wrappers for OpenAPIHono compatibility
const wrapMiddleware = (middleware: MiddlewareHandler): AppMiddleware => {
    return middleware as AppMiddleware;
};

export function createRouter() {
    return new OpenAPIHono<AppBindings>({
        strict: false,
        defaultHook: (result, c) => {
            if (result.success) {
                return;
            }

            const transformedError = transformZodError(result.error);

            return c.json(
                {
                    success: false,
                    error: {
                        code: transformedError.code,
                        messageKey: transformedError.messageKey,
                        details: transformedError.details,
                        summary: transformedError.summary,
                        userFriendlyMessage: transformedError.userFriendlyMessage
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: c.get('requestId') || 'unknown'
                    }
                },
                400
            );
        }
    });
}

export function createApp() {
    const app = createRouter();

    // Set up global error handler
    app.onError(createErrorHandler());

    // Health check endpoint - registered BEFORE the middleware chain
    // so load balancers and monitoring systems get fast responses
    // without going through rate limiting, auth, CORS, or any other middleware
    app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

    // Early stage: Request setup and logging
    app.use(wrapMiddleware(requestId()))
        .use(serveEmojiFavicon('📝'))
        .use(wrapMiddleware(sentryMiddleware()))
        .use(wrapMiddleware(loggerMiddleware))

        // Security and access control
        .use(wrapMiddleware(corsMiddleware()))
        .use(wrapMiddleware(originVerificationMiddleware))
        .use(wrapMiddleware(securityHeadersMiddleware))
        .use(wrapMiddleware(rateLimitMiddleware))

        // Performance: compression early for all responses
        .use(wrapMiddleware(compressionMiddleware()))

        // Body size limit (enforced at stream level, covers chunked transfer encoding)
        // Vercel serverless has a 4.5MB payload limit; local dev allows 10MB
        .use(
            wrapMiddleware(
                bodyLimit({
                    // pre-validation: createApp() may be called before validateApiEnv() in tests
                    maxSize: process.env.VERCEL
                        ? 4.5 * 1024 * 1024 // 4.5MB for Vercel serverless
                        : 10 * 1024 * 1024, // 10MB for long-running server
                    onError: (c) => {
                        return c.json(
                            {
                                success: false,
                                error: {
                                    code: 'REQUEST_TOO_LARGE',
                                    message: 'Request body exceeds the maximum allowed size'
                                }
                            },
                            413
                        );
                    }
                })
            )
        )

        // Request processing: validation BEFORE caching to avoid caching invalid requests
        .use(wrapMiddleware(validationMiddleware()))

        // Performance: caching AFTER validation (only cache valid requests)
        .use(wrapMiddleware(cacheMiddleware()))
        .use(wrapMiddleware(metricsMiddleware()))

        // Response formatting
        .use(wrapMiddleware(responseFormattingMiddleware))

        // Response validation (development/test only by default)
        .use(wrapMiddleware(responseValidatorMiddleware));

    // pre-validation: createApp() may be called before validateApiEnv() in tests
    if (process.env.NODE_ENV === 'test') {
        app.use(wrapMiddleware(lazyMockAuthMiddleware));
    }

    // Authentication and authorization
    app.use(wrapMiddleware(authMiddleware())).use(wrapMiddleware(actorMiddleware()));

    // Billing context (after authentication)
    app.use(wrapMiddleware(billingMiddleware));

    // Billing customer sync (after billing middleware)
    app.use(wrapMiddleware(billingCustomerMiddleware()));

    // Entitlement checking (after billing customer middleware)
    app.use(wrapMiddleware(entitlementMiddleware()));

    // Trial expiry checking (after entitlement middleware)
    // Blocks access with 402 when trial has expired, allows billing/export/docs routes
    app.use(wrapMiddleware(trialMiddleware()));

    app.notFound(notFound);

    return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>): AppOpenAPI<S> {
    return createApp().route('/', router);
}

/**
 * Creates a minimal Hono app optimized for documentation endpoints
 * Includes only essential middlewares and avoids those that interfere with docs UI
 */
export function createDocApp() {
    const app = createRouter();

    // Set up global error handler (essential for proper error handling)
    app.onError(createErrorHandler());

    // Essential middlewares for documentation endpoints (Swagger UI, Scalar, etc.)
    app.use(wrapMiddleware(requestId()));
    app.use(serveEmojiFavicon('📝'));
    app.use(wrapMiddleware(loggerMiddleware)); // Needed for request logging
    app.use(wrapMiddleware(corsMiddleware())); // Needed for cross-origin requests and assets
    app.use(wrapMiddleware(compressionMiddleware())); // Helps with large documentation assets

    // Skip these middlewares that can interfere with documentation:
    // - rateLimitMiddleware (can block documentation loading)
    // - securityHeadersMiddleware (CSP can block inline scripts/styles)
    // - cacheMiddleware (can cause stale documentation)
    // - metricsMiddleware (not needed for docs)
    // - validationMiddleware (not needed for static content)
    // - responseFormattingMiddleware (can interfere with HTML responses)
    // - authMiddleware (documentation should be public)
    // - actorMiddleware (documentation should be public)

    app.notFound(notFound);

    return app;
}

const app = createApp();

export const getApp = () => {
    return app;
};
