/**
 * Swagger UI documentation route
 * Provides interactive API documentation interface
 */
import { swaggerUI } from '@hono/swagger-ui';
import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../../utils/create-app';

const app = createRouter();

// Swagger UI documentation route
const swaggerRoute = createRoute({
    method: 'get',
    path: '/ui',
    summary: 'Swagger UI Documentation',
    description: 'Interactive API documentation interface with Swagger UI',
    tags: ['Documentation'],
    responses: {
        200: {
            description: 'Swagger UI documentation interface',
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

app.openapi(swaggerRoute, async (c) => {
    // swaggerUI() returns a Hono v3-style middleware signature that is incompatible
    // with OpenAPI route handler types. Casting is the only workaround until @hono/swagger-ui
    // exports a typed OpenAPI handler variant.
    // biome-ignore lint/suspicious/noExplicitAny: Hono middleware type incompatibility with swaggerUI return type
    const swaggerMiddleware = swaggerUI({ url: '/docs/openapi.json' }) as any;
    return swaggerMiddleware(c, () => Promise.resolve());
});

export { app as swaggerRoutes };
