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
    // Scalar() returns a middleware whose return type does not match the OpenAPI route handler
    // signature. @scalar/hono-api-reference does not export a typed OpenAPI variant.
    const scalarMiddleware = Scalar({
        url: '/docs/openapi.json',
        theme: 'moon',
        layout: 'modern',
        defaultHttpClient: {
            targetKey: 'js',
            clientKey: 'fetch'
        },
        hideDarkModeToggle: true,
        slug: 'api-1',
        title: 'API #1'
        // (Same typing issue as the Scalar() call above.)
        // biome-ignore lint/suspicious/noExplicitAny: Hono middleware type incompatibility with apiReference return type
    }) as any;

    return scalarMiddleware(c, () => Promise.resolve());
});

export { app as scalarRoutes };
