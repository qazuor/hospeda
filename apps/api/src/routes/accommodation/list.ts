import { createRoute, z } from '@hono/zod-openapi';
import { getActorFromContext } from '../../utils/actor';
import createApp from '../../utils/create-app';
import { accommodationListSchema } from './schemas';

const app = createApp();

export const accommodationListOpenAPIRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'accommodation list',
    description: 'Returns accommodation list',
    tags: ['accommodations'],
    responses: {
        200: {
            description: 'accommodation list',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: accommodationListSchema,
                        metadata: z.object({
                            timestamp: z.string(),
                            requestId: z.string(),
                            total: z.number(),
                            count: z.number()
                        })
                    })
                }
            }
        }
    }
});

app.openapi(accommodationListOpenAPIRoute, (c) => {
    // Get actor from context (will be either authenticated user or guest)
    const actor = getActorFromContext(c);

    const accommodations = [
        {
            id: '1',
            age: 20,
            name: 'Ultra-man'
        },
        {
            id: '2',
            age: 21,
            name: 'Super-man'
        }
    ];

    return c.json({
        success: true,
        data: accommodations,
        metadata: {
            timestamp: new Date().toISOString(),
            requestId: c.req.header('x-request-id') || 'unknown',
            total: accommodations.length,
            count: accommodations.length,
            actor: {
                id: actor.id,
                role: actor.role
            }
        }
    });
});

export { app as accommodationListRoute };
