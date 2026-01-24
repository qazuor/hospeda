import packageJSON from '../../package.json' with { type: 'json' };
import type { AppOpenAPI } from '../types';
import { env } from './env';
import { apiLogger } from './logger';

export default function configureOpenAPI(app: AppOpenAPI) {
    try {
        apiLogger.debug('🔧 Configuring OpenAPI endpoint...');

        app.doc('/docs/openapi.json', {
            openapi: '3.0.0',
            info: {
                title: packageJSON.name,
                version: packageJSON.version,
                description: packageJSON.description
            },
            servers: [
                {
                    url: `http://${env.API_HOST}:${env.API_PORT}`,
                    description: 'Development server'
                }
            ]
        });

        apiLogger.debug('✅ OpenAPI endpoint configured successfully');

        // Add error handling middleware specifically for OpenAPI endpoint
        app.onError((err, c) => {
            if (c.req.path === '/docs/openapi.json') {
                apiLogger.error('❌ OpenAPI generation error:', `${err.message} - ${c.req.url}`);

                if (err.message.includes('TagSchema')) {
                    apiLogger.error('🔍 TagSchema dependency issue detected in OpenAPI generation');
                }

                return c.json(
                    {
                        error: 'OpenAPI generation failed',
                        message: err.message,
                        debug: process.env.NODE_ENV === 'development' ? err.stack : undefined
                    },
                    500
                );
            }
            throw err;
        });
    } catch (error) {
        apiLogger.error('Failed to configure OpenAPI:', String(error));
        throw error;
    }
    // Note: Scalar API Reference is configured in routes/docs/scalar.ts
}
