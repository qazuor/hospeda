/**
 * Liveness check route (v2)
 * Indicates if the service is alive
 * ⚠️ REVERTED from createSimpleRoute due to security headers issue
 * TODO: Fix route factory security headers and re-migrate
 */
import { createRoute } from '@hono/zod-openapi';
import { HealthLivenessSchema } from '@repo/schemas';
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
                    schema: HealthLivenessSchema
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
