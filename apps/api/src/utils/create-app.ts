import type { Context, MiddlewareHandler, Schema } from 'hono';

import { OpenAPIHono } from '@hono/zod-openapi';
import { requestId } from 'hono/request-id';
import { actorMiddleware } from '../middlewares/actor';
import { clerkAuth } from '../middlewares/auth';
import { cacheMiddleware } from '../middlewares/cache';
import { compressionMiddleware } from '../middlewares/compression';
import { corsMiddleware } from '../middlewares/cors';
import { loggerMiddleware } from '../middlewares/logger';
import { createErrorHandler } from '../middlewares/response';

import { metricsMiddleware } from '../middlewares/metrics';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import { responseFormattingMiddleware } from '../middlewares/response';
import { securityHeadersMiddleware } from '../middlewares/security';
import { validationMiddleware } from '../middlewares/validation';
import type { AppBindings, AppMiddleware, AppOpenAPI } from '../types';

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
        strict: false
    });
}

export default function createApp() {
    const app = createRouter();

    // Set up global error handler
    app.onError(createErrorHandler());

    app.use(wrapMiddleware(requestId()))
        .use(serveEmojiFavicon('📝'))
        .use(wrapMiddleware(loggerMiddleware))
        .use(wrapMiddleware(corsMiddleware))
        .use(wrapMiddleware(rateLimitMiddleware))
        .use(wrapMiddleware(securityHeadersMiddleware))
        .use(wrapMiddleware(compressionMiddleware))
        .use(wrapMiddleware(cacheMiddleware))
        .use(wrapMiddleware(metricsMiddleware))
        .use(wrapMiddleware(validationMiddleware))
        .use(wrapMiddleware(responseFormattingMiddleware))
        .use(wrapMiddleware(clerkAuth()))
        .use(wrapMiddleware(actorMiddleware()));

    app.notFound(notFound);

    return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>): AppOpenAPI<S> {
    return createApp().route('/', router);
}

const app = createApp();

export const getApp = () => {
    return app;
};
