import { createRoute } from '@hono/zod-openapi';
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
                    schema: accommodationListSchema
                }
            }
        }
    }
});

app.openapi(accommodationListOpenAPIRoute, (c) => {
    return c.json([
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
    ]);
});

export { app as accommodationListRoute };
