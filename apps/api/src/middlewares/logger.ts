/**
 * Logging middleware for API requests
 * Logs all incoming requests and responses with timing information
 * Uses structured apiLogger for consistency
 */
import type { MiddlewareHandler } from 'hono';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    // const path = c.req.path; // Available for future use

    if (env.LOG_LEVEL === 'debug') {
        apiLogger.debug(`🔍 Incoming request: ${method} ${url}`);
    }

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    const logMessage = `${method} ${url} ${status} ${duration}ms`;

    // Use structured apiLogger for consistency
    if (status >= 500) {
        apiLogger.error(`❌ HTTP ERROR => ${logMessage}`, 'ERROR');
    } else if (status >= 400) {
        apiLogger.warn(`⚠️ HTTP WARNING => ${logMessage}`, 'WARNING');
    } else {
        apiLogger.info(`✅ HTTP SUCCESS => ${logMessage}`, 'SUCCESS');
    }

    // Log response body in debug mode for errors
    if (env.LOG_LEVEL === 'debug' && status >= 400) {
        try {
            const responseText = await c.res.clone().text();
            apiLogger.error(`📄 Error Response Body: ${responseText}`);
        } catch {
            apiLogger.error('💥 Failed to log response body');
        }
    }
};
