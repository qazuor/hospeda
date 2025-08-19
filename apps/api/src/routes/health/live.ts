/**
 * Liveness check route (v2)
 * Indicates if the service is alive
 * ⚠️ REVERTED from createSimpleRoute due to security headers issue
 * TODO: Fix route factory security headers and re-migrate
 */
import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '../../utils/create-app';

const app = createRouter();

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
            requestId: c.get('requestId') || 'unknown'
        }
    });
});

export { app as liveRoutes };
