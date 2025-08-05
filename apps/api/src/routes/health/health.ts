/**
 * Main health check route
 * Returns the health status of the API
 */
import { createRoute, z } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';

const app = createApp();

// Health check schema
const HealthDataSchema = z.object({
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
                    schema: z.object({
                        success: z.boolean(),
                        data: HealthDataSchema,
                        metadata: z.object({
                            timestamp: z.string(),
                            requestId: z.string()
                        })
                    })
                }
            }
        }
    }
});

app.openapi(healthRoute, (c) => {
    const uptime = process.uptime();
    const data = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    return c.json({
        success: true,
        data,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.req.header('x-request-id') || 'unknown'
        }
    });
});

export { app as healthRoutes };
