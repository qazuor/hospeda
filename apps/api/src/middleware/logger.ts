import { apiLogger } from '@/utils/logger';
import type { Context, Next } from 'hono';

export async function loggerMiddleware(c: Context, next: Next) {
    const method = c.req.method;
    const path = c.req.path;
    const startTime = Date.now();

    try {
        // Log the incoming request
        apiLogger.info({ location: 'API:Request' }, `${method} ${path}`);

        // Process the request
        await next();

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log the completed request
        const status = c.res?.status || 200;
        apiLogger.info(
            { location: 'API:Response' },
            `${method} ${path} ${status} ${responseTime}ms`
        );
    } catch (error) {
        // Calculate response time for errors too
        const responseTime = Date.now() - startTime;

        // Let the error propagate to the error middleware
        apiLogger.error(error as Error, `API:Error - ${method} ${path} ERROR ${responseTime}ms`);
        throw error;
    }
}
