import { logger as apiLogger } from '@repo/logger';
/**
 * Logging middleware for API requests
 * Logs all incoming requests and responses with timing information
 */
import type { MiddlewareHandler } from 'hono';
import { env } from '../utils/env';

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const url = c.req.url;

    if (env.LOG_LEVEL === 'debug') {
        apiLogger.debug('Incoming request', `${method} ${url}`, {
            category: 'api',
            debug: true
        });
    }

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    const logMessage = `${method} ${url} ${status} ${duration}ms`;

    if (status >= 500) {
        apiLogger.error(logMessage, 'Request Error');
    } else if (status >= 400) {
        apiLogger.warn(logMessage, 'Request Warning');
    } else {
        apiLogger.info(logMessage, 'Request Success');
    }

    // Log response body in debug mode for errors
    if (env.LOG_LEVEL === 'debug' && status >= 400) {
        try {
            const responseText = await c.res.clone().text();
            apiLogger.error(responseText, 'Error Response', { category: 'api', debug: true });
        } catch {
            apiLogger.error('Failed to log response body', 'Logging Error', { category: 'api' });
        }
    }
};
