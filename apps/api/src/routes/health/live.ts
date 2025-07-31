/**
 * Liveness check route
 * Indicates if the service is alive
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

export { app as liveRoutes };
