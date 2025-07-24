/**
 * Main Hono application configuration
 * Sets up the API with OpenAPI integration
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { setupMiddlewares } from './middlewares';
import { setupRoutes } from './routes';
import { env } from './utils/env';

/**
 * Create Hono app instance with OpenAPI integration
 */
const app = new OpenAPIHono({
    defaultHook: (result, c) => {
        if (!result.success) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input data',
                        details: result.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message,
                            code: issue.code
                        }))
                    }
                },
                400
            );
        }
    }
});

// Setup OpenAPI documentation
app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
        title: 'Hospeda API',
        version: '1.0.0',
        description: `
      Complete API for the Hospeda tourism accommodation platform.
      
      ## Features
      - RESTful API with public and administrative endpoints
      - JWT authentication with Clerk
      - Strict validation with Zod
      - Consistent and typed responses
      - Rate limiting and CSRF protection
      - Internationalization support
      
      ## Authentication
      For administrative endpoints, include the session token in the header:
      \`Authorization: Bearer <token>\`
    `,
        contact: {
            name: 'Hospeda Development Team',
            email: 'dev@hospeda.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [
        {
            url: `http://${env.API_HOST}:${env.API_PORT}`,
            description: 'Development server'
        }
    ]
});

// Setup middlewares
setupMiddlewares(app);

// Setup routes
setupRoutes(app);

// Configure OpenAPI documentation after all routes are defined
app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
        title: 'Hospeda API',
        version: '1.0.0',
        description: 'Complete API for the Hospeda tourism accommodation platform'
    },
    servers: [
        {
            url: `http://${env.API_HOST}:${env.API_PORT}`,
            description: 'Development server'
        }
    ]
});

export default app;
export { app };
