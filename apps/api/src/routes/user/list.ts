import { createRoute } from '@hono/zod-openapi';
import createApp from '../../utils/create-app';
import { UserListSchema } from './schemas';

const app = createApp();

export const userListOpenAPIRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'User list',
    description: 'Returns user list',
    tags: ['Users'],
    responses: {
        200: {
            description: 'user list',
            content: {
                'application/json': {
                    schema: UserListSchema
                }
            }
        }
    }
});

app.openapi(userListOpenAPIRoute, (c) => {
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

export { app as userListRoute };
