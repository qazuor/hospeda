/**
 * Documentation index route
 * Redirects to the main API documentation interface
 */
import { createRoute } from '@hono/zod-openapi';
import { createSimpleApp } from '../../utils/create-app';

const app = createSimpleApp();

// Documentation index route - redirects to Swagger UI
const docsIndexRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Documentation Index',
    description: 'Redirects to the main API documentation interface',
    tags: ['Documentation'],
    responses: {
        302: {
            description: 'Redirect to Swagger UI documentation',
            content: {
                'text/html': {
                    schema: {
                        type: 'string'
                    }
                }
            }
        }
    }
});

app.openapi(docsIndexRoute, async (c) => {
    return c.redirect('/docs/ui');
});

export { app as docsIndexRoutes };
