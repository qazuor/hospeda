/**
 * Readiness check route
 * Indicates if the service is ready to serve requests
 */
import { createRoute, z } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';

const app = createApp();

// Readiness check route
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
                        success: z.boolean(),
                        data: z.object({
                            ready: z.boolean(),
                            timestamp: z.string()
                        }),
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

app.openapi(readyRoute, (c) => {
    const data = {
        ready: true,
        timestamp: new Date().toISOString()
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

export { app as readyRoutes };
