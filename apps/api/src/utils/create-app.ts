import type { Context, MiddlewareHandler, Schema } from 'hono';

import { OpenAPIHono } from '@hono/zod-openapi';
import { requestId } from 'hono/request-id';
import { authMiddleware } from '../middlewares/auth';
import { cacheMiddleware } from '../middlewares/cache';
import { compressionMiddleware } from '../middlewares/compression';
import { corsMiddleware } from '../middlewares/cors';
import { loggerMiddleware } from '../middlewares/logger';
import { metricsMiddleware } from '../middlewares/metrics';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import { responseFormattingMiddleware } from '../middlewares/response';
import { securityHeadersMiddleware } from '../middlewares/security';
import { validationMiddleware } from '../middlewares/validation';
import type { AppBindings, AppOpenAPI } from '../types';

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

const onError = async (err: Error, c: Context<AppBindings>) => {
    console.error('Unhandled error:', err);
    return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        500
    );
};

export function createRouter() {
    return new OpenAPIHono<AppBindings>({
        strict: false
    });
}

export default function createApp() {
    const app = createRouter();

    // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues require type assertions
    app.use(requestId() as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(serveEmojiFavicon('📝') as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(loggerMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(corsMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(rateLimitMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(securityHeadersMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(compressionMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(cacheMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(metricsMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(validationMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(responseFormattingMiddleware as any)
        // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
        .use(authMiddleware as any);

    // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
    app.notFound(notFound as any);
    // biome-ignore lint/suspicious/noExplicitAny: Hono version compatibility issues
    app.onError(onError as any);
    return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>): AppOpenAPI<S> {
    return createApp().route('/', router);
}

const app = createApp();

export const getApp = () => {
    return app;
};
