/**
 * Scalar API Reference documentation route
 * Provides modern API documentation interface
 */
import { createRoute } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { createRouter } from '../../utils/create-app';

const app = createRouter();

// Scalar API Reference documentation route
const scalarRoute = createRoute({
    method: 'get',
    path: '/reference',
    summary: 'Scalar API Reference',
    description: 'Modern API documentation interface with Scalar API Reference',
    tags: ['Documentation'],
    responses: {
        200: {
            description: 'Scalar API Reference documentation interface',
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

app.openapi(scalarRoute, async (c) => {
    const scalarMiddleware = Scalar({
        url: '/docs/openapi.json',
        theme: 'kepler',
        layout: 'classic',
        defaultHttpClient: {
            targetKey: 'js',
            clientKey: 'fetch'
        }
        // biome-ignore lint/suspicious/noExplicitAny: Scalar middleware has type compatibility issues with Hono versions
    }) as any;

    return scalarMiddleware(c, () => Promise.resolve());
});

export { app as scalarRoutes };
