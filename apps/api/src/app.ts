import { healthRoutes } from '@/routes/health';
import { initDb } from '@/utils/db';
import { apiLogger } from '@/utils/logger';
import { Hono } from 'hono';
import { errorMiddleware } from './middleware/error';
import { loggerMiddleware } from './middleware/logger';
import { apiV1Routes } from './routes/v1';

initDb();

// Create the main Hono app
const app = new Hono();

// Apply global middlewares
app.use('*', loggerMiddleware);
app.use('*', errorMiddleware);

// Base route
app.get('/', (c) => {
    return c.json({
        name: 'Hospeda API',
        version: '1.0.0',
        status: 'operational'
    });
});

// API routes
app.route('/api/v1', apiV1Routes);
app.route('/health', healthRoutes);

// 404 handler
app.notFound((c) => {
    apiLogger.warn({ location: 'API:NotFound' }, `Route not found: ${c.req.method} ${c.req.url}`);
    return c.json(
        {
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found'
            }
        },
        404
    );
});

// Export the app
export { app };
