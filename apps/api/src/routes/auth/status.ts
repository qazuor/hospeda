import { getAuth } from '@hono/clerk-auth';
/**
 * Authentication status route
 * Simple endpoint to check authentication status and actor information
 */
import { createRoute, z } from '@hono/zod-openapi';
import { getActorFromContext } from '../../utils/actor';
import createApp from '../../utils/create-app';

const app = createApp();

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
                    schema: z.object({
                        success: z.boolean(),
                        data: z.object({
                            isAuthenticated: z.boolean(),
                            userId: z.string().nullish(),
                            actor: z.object({
                                id: z.string(),
                                role: z.string(),
                                permissions: z.array(z.string())
                            })
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

app.openapi(authStatusOpenAPIRoute, (c) => {
    const auth = getAuth(c);
    const actor = getActorFromContext(c);

    return c.json({
        success: true,
        data: {
            isAuthenticated: !!auth?.userId,
            userId: auth?.userId,
            actor: {
                id: actor.id,
                role: actor.role,
                permissions: actor.permissions
            }
        },
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.req.header('x-request-id') || 'unknown'
        }
    });
});

export { app as authStatusRoute };
