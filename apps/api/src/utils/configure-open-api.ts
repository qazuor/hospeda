import packageJSON from '../../package.json' with { type: 'json' };
import { createErrorHandler } from '../middlewares/response';
import type { AppOpenAPI } from '../types';
import { env } from './env';
import { apiLogger } from './logger';
import { applyMediaMultipartOpenApiOverrides } from './openapi-multipart-overrides';

export function configureOpenAPI(app: AppOpenAPI) {
    try {
        apiLogger.debug('🔧 Configuring OpenAPI endpoint...');

        // Inline the spec config so it can be re-used both by the registered
        // `app.doc()` handler and by the post-processing GET below.
        const docConfig = {
            openapi: '3.0.0' as const,
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
        };

        // Custom GET handler that builds the OpenAPI document at request
        // time and post-processes it to inject `multipart/form-data` request
        // bodies on media upload routes (SPEC-078-GAPS T-034 / GAP-078-072).
        //
        // We cannot declare the multipart body via the route factory because
        // doing so makes `@hono/zod-openapi` register a body validator that
        // fails on real multipart payloads (the validator only understands
        // JSON). Post-processing keeps the runtime contract intact (handlers
        // own multipart parsing) while exposing the actual upload schema in
        // the docs.
        app.get('/docs/openapi.json', (c) => {
            const document = app.getOpenAPIDocument(docConfig);
            // The OpenAPIObject type from `@hono/zod-openapi` does not have
            // an index signature, so we widen via `unknown` before handing
            // it to the post-processor (which only mutates the `paths`
            // sub-tree and is intentionally schema-agnostic).
            // TYPE-WORKAROUND: OpenAPIObject from @hono/zod-openapi has no index signature, but the post-processor only mutates the `paths` sub-tree and is intentionally schema-agnostic; cast widens the doc shape.
            const annotated = applyMediaMultipartOpenApiOverrides(
                document as unknown as Record<string, unknown>
            );
            return c.json(annotated);
        });

        apiLogger.debug('✅ OpenAPI endpoint configured successfully');

        // Override the error handler to add OpenAPI-specific handling
        // while preserving the main error handler as fallback
        const mainErrorHandler = createErrorHandler();
        app.onError((err, c) => {
            if (c.req.path === '/docs/openapi.json') {
                apiLogger.error('❌ OpenAPI generation error:', `${err.message} - ${c.req.url}`);

                if (err.message.includes('TagSchema')) {
                    apiLogger.error('🔍 TagSchema dependency issue detected in OpenAPI generation');
                }

                const isDebug = env.HOSPEDA_API_DEBUG_ERRORS;
                return c.json(
                    {
                        error: 'OpenAPI generation failed',
                        message: isDebug ? err.message : undefined,
                        debug: isDebug ? err.stack : undefined
                    },
                    500
                );
            }
            // Delegate to the main error handler for all other routes
            return mainErrorHandler(err, c);
        });
    } catch (error) {
        apiLogger.error('Failed to configure OpenAPI:', String(error));
        throw error;
    }
    // Note: Scalar API Reference is configured in routes/docs/scalar.ts
}
