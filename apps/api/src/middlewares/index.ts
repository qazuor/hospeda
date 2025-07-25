/**
 * Centralized middleware configuration
 * Order matters - middlewares are applied in sequence
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { prettyJSON } from 'hono/pretty-json';
import { env } from '../utils/env';
import { advancedCors } from './cors';
import { errorHandler } from './error-handler';
import { loggerMiddleware } from './logger';
import { advancedLogging } from './logging';
import { notFoundHandler } from './not-found';
import { rateLimiter } from './rate-limiter';
import { apiSecurityHeaders } from './security-headers';
import { timeoutMiddleware } from './timeout';

/**
 * Setup all middlewares in the correct order
 * @param app - OpenAPI Hono app instance
 */
export const setupMiddlewares = (app: OpenAPIHono) => {
    // 1. Error handler (must be first to catch all errors)
    app.onError(errorHandler);

    // 2. Not found handler
    app.notFound(notFoundHandler);

    // 3. Security headers (early for all requests)
    app.use('*', apiSecurityHeaders());

    // 4. Advanced CORS (before other request processing)
    app.use(
        '*',
        advancedCors({
            environment:
                (env.NODE_ENV as 'development' | 'production' | 'testing') || 'development',
            enableLogging: env.NODE_ENV === 'development',
            additionalOrigins:
                env.NODE_ENV === 'development'
                    ? [
                          'http://localhost:5173', // Vite
                          'http://localhost:8080' // Webpack dev server
                      ]
                    : []
        })
    );

    // 5. Advanced request logging (capture all requests with detailed info)
    if (env.ENABLE_REQUEST_LOGGING) {
        app.use(
            '*',
            advancedLogging({
                logRequests: true,
                logResponses: true,
                detailed: env.NODE_ENV === 'development',
                excludePaths: [
                    '/health',
                    '/health/ready',
                    '/health/live',
                    '/ping',
                    '/favicon.ico',
                    '/docs'
                ]
            })
        );
    } else {
        // Fallback to simple logger
        app.use('*', loggerMiddleware);
    }

    // 6. Advanced timeout protection (with shorter timeout for most endpoints)
    app.use(
        '*',
        timeoutMiddleware({
            type: 'quick', // 5 seconds for most endpoints
            enableLogging: true
        })
    );

    // 7. Pretty JSON (development only)
    if (env.NODE_ENV === 'development') {
        app.use('*', prettyJSON());
    }

    // 8. Advanced rate limiter (control abuse with multiple strategies)
    app.use('*', rateLimiter('default'));

    // Note: Authentication middleware will be applied per route group
};

/**
 * Specific middleware configurations for different route groups
 */

/**
 * Admin routes middleware stack
 */
export const adminMiddlewares = (app: OpenAPIHono, basePath: string) => {
    app.use(`${basePath}/*`, rateLimiter('admin'));
    app.use(`${basePath}/*`, timeoutMiddleware({ type: 'admin' }));
};

/**
 * Search routes middleware stack
 */
export const searchMiddlewares = (app: OpenAPIHono, basePath: string) => {
    app.use(`${basePath}/*`, rateLimiter('search'));
    app.use(`${basePath}/*`, timeoutMiddleware({ type: 'search' }));
};

/**
 * Auth routes middleware stack
 */
export const authMiddlewares = (app: OpenAPIHono, basePath: string) => {
    app.use(`${basePath}/*`, rateLimiter('auth'));
    app.use(`${basePath}/*`, timeoutMiddleware({ type: 'quick' }));
};

/**
 * Public routes middleware stack (more permissive)
 */
export const publicMiddlewares = (app: OpenAPIHono, basePath: string) => {
    app.use(`${basePath}/*`, rateLimiter('public'));
    app.use(`${basePath}/*`, timeoutMiddleware({ type: 'standard' }));
};
