/**
 * Main Hono application configuration
 * Sets up the API with OpenAPI integration
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { ServiceErrorCode } from '@repo/types';
import { setupMiddlewares } from './middlewares';
import { setupRoutes } from './routes';
import { env } from './utils/env';
import { generateRequestId } from './utils/request-id.js';

/**
 * Create Hono app instance with OpenAPI integration
 */
const app = new OpenAPIHono({
    defaultHook: (result, c) => {
        if (!result.success) {
            const requestId = generateRequestId();
            return c.json(
                {
                    success: false,
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    requestId,
                    timestamp: new Date().toISOString(),
                    error: 'Validation failed',
                    details: {
                        issues: result.error.issues.map((issue) => ({
                            field: issue.path?.join('.') || '',
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

// Add finalize hook to intercept all responses
app.use('*', async (c, next) => {
    await next();

    // Only process 400 responses that might be validation errors
    if (c.res.status === 400) {
        const contentType = c.res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            const responseClone = c.res.clone();
            const responseText = await responseClone.text();

            try {
                const responseBody = JSON.parse(responseText);

                // Check if it's the old ZodError format
                if (
                    responseBody.success === false &&
                    responseBody.error &&
                    responseBody.error.name === 'ZodError' &&
                    Array.isArray(responseBody.error.issues)
                ) {
                    // Create new consistent response
                    const newResponse = {
                        success: false,
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        requestId: generateRequestId(),
                        timestamp: new Date().toISOString(),
                        error: 'Validation failed',
                        details: {
                            issues: responseBody.error.issues
                        }
                    };

                    // Override response with new format
                    c.res = new Response(JSON.stringify(newResponse), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            ...Object.fromEntries(c.res.headers.entries())
                        }
                    });
                }
            } catch {
                // Ignore parsing errors
            }
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
