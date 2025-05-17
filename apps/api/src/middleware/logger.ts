import { logger } from '@repo/logger';
import type { Context, Next } from 'hono';

export async function loggerMiddleware(c: Context, next: Next) {
    const method = c.req.method;
    const path = c.req.path;
    const startTime = Date.now();

    try {
        // Log the incoming request
        logger.info(`${method} ${path}`, 'API:Request');

        // Process the request
        await next();

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log the completed request
        const status = c.res?.status || 200;
        logger.info(`${method} ${path} ${status} ${responseTime}ms`, 'API:Response');
    } catch (error) {
        // Calculate response time for errors too
        const responseTime = Date.now() - startTime;

        // Let the error propagate to the error middleware
        logger.error(`${method} ${path} ERROR ${responseTime}ms`, 'API:Error', error);
        throw error;
    }
}
