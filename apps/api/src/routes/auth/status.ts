/**
 * Authentication status route
 * Simple endpoint to check authentication status and actor information
 */
import { createRoute } from '@hono/zod-openapi';
import { AuthStatusResponseSchema } from '@repo/schemas';
import { getActorFromContext } from '../../utils/actor';
import { createRouter } from '../../utils/create-app';

const app = createRouter();

export const authStatusOpenAPIRoute = createRoute({
    method: 'get',
    path: '/status',
    summary: 'Authentication status',
    description: 'Check current authentication status and actor information',
    tags: ['auth'],
    responses: {
        200: {
            description: 'Authentication status response',
            content: {
                'application/json': {
                    schema: AuthStatusResponseSchema
                }
            }
        }
    }
});

app.openapi(authStatusOpenAPIRoute, (c) => {
    const user = c.get('user');
    const actor = getActorFromContext(c);

    return c.json({
        success: true,
        data: {
            isAuthenticated: !!user?.id,
            userId: user?.id,
            actor: {
                id: actor.id,
                role: actor.role,
                permissions: actor.permissions
            }
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown'
        }
    });
});

export { app as authStatusRoute };
