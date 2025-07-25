/**
 * Health check routes
 * Provides system health and status information
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

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

// Readiness check
const readyRoute = createRoute({
    method: 'get',
    path: '/ready',
    summary: 'Readiness check',
    description: 'Indicates if the service is ready to serve requests',
    tags: ['Health'],
    responses: {
        200: {
            description: 'Service is ready',
            content: {
                'application/json': {
                    schema: z.object({
                        ready: z.boolean(),
                        timestamp: z.string()
                    })
                }
            }
        }
    }
});

app.openapi(readyRoute, (c) => {
    return c.json({
        ready: true,
        timestamp: new Date().toISOString()
    });
});

// Liveness check
const liveRoute = createRoute({
    method: 'get',
    path: '/live',
    summary: 'Liveness check',
    description: 'Indicates if the service is alive',
    tags: ['Health'],
    responses: {
        200: {
            description: 'Service is alive',
            content: {
                'application/json': {
                    schema: z.object({
                        alive: z.boolean(),
                        timestamp: z.string()
                    })
                }
            }
        }
    }
});

app.openapi(liveRoute, (c) => {
    return c.json({
        alive: true,
        timestamp: new Date().toISOString()
    });
});

export { app as healthRoutes };
