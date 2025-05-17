import { logger } from '@repo/logger';
import { Hono } from 'hono';
import { errorMiddleware } from './middleware/error';
import { loggerMiddleware } from './middleware/logger';
import { apiV1Routes } from './routes/v1';

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

// Health check endpoint
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.route('/api/v1', apiV1Routes);

// 404 handler
app.notFound((c) => {
    logger.warn(`Route not found: ${c.req.method} ${c.req.url}`, 'API:NotFound');
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
