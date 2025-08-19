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
    // biome-ignore lint/suspicious/noExplicitAny: Swagger middleware has type compatibility issues with Hono versions
    const swaggerMiddleware = swaggerUI({ url: '/docs/openapi.json' }) as any;
    return swaggerMiddleware(c, () => Promise.resolve());
});

export { app as swaggerRoutes };
