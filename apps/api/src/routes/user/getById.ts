import { createRoute } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';
import { ParamsSchema, UserSchema } from './schemas';

const app = createApp();

export const userGetByIdOpenAPIRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'User by id',
    description: 'Returns an user by id',
    tags: ['Users'],
    request: {
        params: ParamsSchema
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: UserSchema
                }
            },
            description: 'Retrieve the user'
        }
    }
});

app.openapi(userGetByIdOpenAPIRoute, (c) => {
    const { id } = c.req.valid('param');
    return c.json({
        id,
        age: 20,
        name: 'Ultra-man'
    });
});

export { app as userGetByIdRoute };
