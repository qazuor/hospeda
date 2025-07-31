import { createRoute } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';
import { ParamsSchema, accommodationSchema } from './schemas';

const app = createApp();

export const accommodationGetByIdOpenAPIRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'accommodation by id',
    description: 'Returns an accommodation by id',
    tags: ['accommodations'],
    request: {
        params: ParamsSchema
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: accommodationSchema
                }
            },
            description: 'Retrieve the accommodation'
        }
    }
});

app.openapi(accommodationGetByIdOpenAPIRoute, (c) => {
    const { id } = c.req.valid('param');
    return c.json({
        id,
        age: 20,
        name: 'Ultra-man'
    });
});

export { app as accommodationGetByIdRoute };
