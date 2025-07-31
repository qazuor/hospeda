import { ServiceErrorCode } from '@repo/types';
import { setupRoutes } from './routes';
import configureOpenAPI from './utils/configure-open-api';
import createApp from './utils/create-app';
import { generateRequestId } from './utils/request-id';

const initApp = () => {
    const app = createApp();

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

    configureOpenAPI(app);

    setupRoutes(app);

    return app;
};

export { initApp };
