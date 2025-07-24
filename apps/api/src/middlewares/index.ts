/**
 * Centralized middleware configuration
 * Order matters - middlewares are applied in sequence
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { timeout } from 'hono/timeout';
import { env } from '../utils/env';
import { errorHandler } from './error-handler';
import { loggerMiddleware } from './logger';
import { notFoundHandler } from './not-found';
import { rateLimiter } from './rate-limiter';

/**
 * Setup all middlewares in the correct order
 * @param app - OpenAPI Hono app instance
 */
export const setupMiddlewares = (app: OpenAPIHono) => {
    // 1. Error handler (must be first to catch all errors)
    app.onError(errorHandler);

    // 2. Not found handler
    app.notFound(notFoundHandler);

    // 3. Logger (capture all requests)
    if (env.ENABLE_REQUEST_LOGGING) {
        app.use('*', loggerMiddleware);
    }

    // 4. CORS (allow cross-origin requests)
    app.use(
        '*',
        cors({
            origin: env.CORS_ORIGINS,
            allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept-Language'],
            allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            credentials: true
        })
    );

    // 5. Timeout (prevent hanging requests)
    app.use('*', timeout(30000)); // 30 seconds

    // 6. Pretty JSON (development only)
    if (env.NODE_ENV === 'development') {
        app.use('*', prettyJSON());
    }

    // 7. Rate Limiter (control abuse)
    app.use('*', rateLimiter());

    // Note: Authentication middleware will be applied per route group
};
