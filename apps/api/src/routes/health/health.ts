/**
 * Main health check route
 * Returns the health status of the API
 */
import { createRoute, z } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';

const app = createApp();

// Health check schema
const HealthResponseSchema = z.object({
    status: z.enum(['healthy', 'unhealthy']),
    timestamp: z.string(),
    uptime: z.number(),
    version: z.string(),
    environment: z.string()
});

// Health check route
const healthRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Health check',
    description: 'Returns the health status of the API',
    tags: ['Health'],
    responses: {
        200: {
            description: 'API is healthy',
            content: {
                'application/json': {
                    schema: HealthResponseSchema
                }
            }
        }
    }
});

app.openapi(healthRoute, (c) => {
    const uptime = process.uptime();

    return c.json({
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

export { app as healthRoutes };
