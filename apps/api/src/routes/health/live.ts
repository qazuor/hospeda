/**
 * Liveness check route (v2)
 * Indicates if the service is alive
 * Uses new validation system and response factory
 */
import { createRoute, z } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';

const app = createApp();

// Liveness check route
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
                        success: z.boolean(),
                        data: z.object({
                            alive: z.boolean(),
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

app.openapi(liveRoute, (c) => {
    const data = {
        alive: true,
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

export { app as liveRoutes };
