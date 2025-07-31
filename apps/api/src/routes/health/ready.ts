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

export { app as readyRoutes };
