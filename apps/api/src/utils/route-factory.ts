/**
 * Route factory for creating common API routes
 * Provides helper functions to create CRUD, list, and simple routes with consistent structure
 * Version 2.0 - Improved type safety and additional route types
 */

import { createRoute, z } from '@hono/zod-openapi';
import { PaginationQuerySchema, ServiceErrorCode } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createRouter } from './create-app';
import { createOpenAPISchema } from './openapi-schema';
import { ResponseFactory } from './response-factory';
import {
    type PaginatedResult,
    createPaginatedResponse,
    createResponse,
    handleRouteError
} from './response-helpers';

/**
 * Route configuration options for middleware and behavior customization
 */
export interface RouteOptions {
    /** Skip authentication middleware for this route */
    skipAuth?: boolean;
    /** Skip validation middleware for this route */
    skipValidation?: boolean;
    /** Custom rate limiting for this specific route */
    customRateLimit?: { requests: number; windowMs: number };
    /** Cache TTL in seconds for this route */
    cacheTTL?: number;
    /** Additional middlewares to apply to this route */
    middlewares?: MiddlewareHandler[];
}

/**
 * Interface for creating simple routes (like health checks, version info)
 */
export interface SimpleRouteInterface {
    method: 'get' | 'post';
    path: string;
    summary: string;
    description: string;
    tags: string[];
    responseSchema: z.ZodTypeAny;
    handler: (ctx: Context) => Promise<unknown> | unknown;
    options?: RouteOptions;
}

/**
 * Enhanced interface for creating OpenAPI routes with standardized structure
 * Now with improved type safety and customization options
 */
export interface CreateOpenApiRouteInterface {
    method: 'get' | 'post' | 'put' | 'delete' | 'patch';
    path: string;
    summary: string;
    description: string;
    tags: string[];
    requestParams?: Record<string, z.ZodTypeAny>;
    requestBody?: z.ZodTypeAny;
    requestQuery?: Record<string, z.ZodTypeAny>;
    responseSchema: z.ZodTypeAny;
    handler: (
        c: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => Promise<unknown>;
    options?: RouteOptions;
}

/**
 * Interface for request options configuration
 */
interface CreateRequestOptionsInterface {
    params: Record<string, z.ZodTypeAny>;
    body?: z.ZodTypeAny; // optional to avoid declaring body for GET/DELETE
    query: Record<string, z.ZodTypeAny>;
}

/**
 * Helper function to create body request configuration
 * Reduces boilerplate for body requests
 */
const createBodyRequest = (schema: z.ZodTypeAny) => ({
    content: {
        'application/json': {
            schema
        }
    }
});

/**
 * Helper function to create params request configuration
 * Reduces boilerplate for params requests
 */
const createParamsRequest = (params: Record<string, z.ZodTypeAny>) => z.object(params);

/**
 * Helper function to create query request configuration
 * Reduces boilerplate for query requests
 */
const createQueryRequest = (params: Record<string, z.ZodTypeAny>) => z.object(params);

/**
 * Helper function to create request options for OpenAPI routes
 */
const createRequestOptions = (requestOptions: CreateRequestOptionsInterface) => {
    const parsedRequestOptions: {
        params?: z.ZodObject<Record<string, z.ZodTypeAny>>;
        body?: { content: { 'application/json': { schema: z.ZodTypeAny } } };
        query?: z.ZodObject<Record<string, z.ZodTypeAny>>;
    } = {};

    if (Object.keys(requestOptions.params).length > 0) {
        parsedRequestOptions.params = createParamsRequest(requestOptions.params);
    }

    if (requestOptions.body) {
        parsedRequestOptions.body = createBodyRequest(requestOptions.body);
    }

    if (Object.keys(requestOptions.query).length > 0) {
        parsedRequestOptions.query = createQueryRequest(requestOptions.query);
    }

    return parsedRequestOptions;
};

/**
 * Helper function to apply route-specific middlewares
 */
const applyRouteMiddlewares = (app: ReturnType<typeof createRouter>, options?: RouteOptions) => {
    if (options?.middlewares) {
        for (const middleware of options.middlewares) {
            app.use(middleware);
        }
    }

    // Add route-specific options as context for middlewares to use
    if (options) {
        app.use(async (c: Context, next: () => Promise<void>) => {
            // Store route options for middleware consumption
            // biome-ignore lint/suspicious/noExplicitAny: Context extension for route options
            (c as any).routeOptions = options;
            try {
                await next();
            } catch (error) {
                // Handle malformed JSON errors that occur during validation
                if (error instanceof Error && error.message === 'Malformed JSON in request body') {
                    return c.json(
                        {
                            success: false,
                            error: {
                                code: ServiceErrorCode.VALIDATION_ERROR,
                                message: 'Invalid JSON format in request body'
                            }
                        },
                        400
                    );
                }
                // For other errors, let them propagate to be handled by global error handler
                throw error;
            }
        });
    }

    // Do NOT attach another validation instance here; it's globally registered in create-app

    // ✅ FORCE security headers for route factories
    // This ensures security headers are always applied regardless of env config
    // Fixed test failures where SECURITY_ENABLED was disabled in test environment
    app.use(
        secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    // Allow CDNs for documentation UI (Swagger, Scalar)
                    'https://cdn.jsdelivr.net',
                    'https://unpkg.com'
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    // Allow CDNs for documentation UI (Swagger, Scalar)
                    'https://cdn.jsdelivr.net',
                    'https://unpkg.com'
                ],
                fontSrc: [
                    "'self'",
                    'data:',
                    // Allow fonts for documentation UI (Scalar)
                    'https://fonts.scalar.com',
                    'https://fonts.googleapis.com',
                    'https://fonts.gstatic.com'
                ]
            },
            strictTransportSecurity: 'max-age=31536000; includeSubDomains',
            xFrameOptions: 'SAMEORIGIN',
            xContentTypeOptions: 'nosniff',
            xXssProtection: '1; mode=block',
            referrerPolicy: 'strict-origin-when-cross-origin'
        })
    );
};

/**
 * Helper function to create simple routes (like health checks, version endpoints)
 * Reduces boilerplate for endpoints that don't need complex validation
 * Automatically converts z.date() schemas to OpenAPI-compatible string datetime
 */
export const createSimpleRoute = (options: SimpleRouteInterface) => {
    const app = createRouter();

    // Apply route-specific middlewares
    applyRouteMiddlewares(app, options.options);

    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        responses: ResponseFactory.createCRUDResponses(createOpenAPISchema(options.responseSchema))
    });

    app.openapi(route, async (ctx) => {
        try {
            const result = await options.handler(ctx);
            if (result instanceof Response) {
                return result;
            }
            return createResponse(result, ctx, 200);
        } catch (error) {
            return handleRouteError(error, ctx);
        }
    });

    return app;
};

/**
 * Helper function to create CRUD routes with standardized structure
 * Provides a consistent interface for all CRUD operations
 * Version 2.1 - Automatic OpenAPI schema conversion for date fields
 * Automatically converts z.date() schemas to OpenAPI-compatible string datetime
 */
export const createCRUDRoute = (options: CreateOpenApiRouteInterface) => {
    const app = createRouter();

    // Apply route-specific middlewares
    applyRouteMiddlewares(app, options.options);

    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        request: createRequestOptions({
            params: options.requestParams || {},
            // Do not declare a body for GET/DELETE requests to avoid JSON parsing on empty bodies
            // Apply OpenAPI conversion to request body schemas
            body:
                options.method === 'get' || options.method === 'delete'
                    ? undefined
                    : options.requestBody
                      ? createOpenAPISchema(options.requestBody)
                      : undefined,
            query: options.requestQuery || {}
        }),
        // Apply OpenAPI conversion to response schemas
        responses: ResponseFactory.createCRUDResponses(createOpenAPISchema(options.responseSchema))
    });

    app.openapi(route, async (ctx) => {
        try {
            // ✅ Properly handle validated parameters from OpenAPI
            // Use validated params if requestParams is defined, otherwise use raw params
            const params =
                options.requestParams && Object.keys(options.requestParams).length > 0
                    ? // biome-ignore lint/suspicious/noExplicitAny: Hono validation returns transformed data
                      (ctx.req as any).valid('param')
                    : ctx.req.param() || {};
            // Only parse JSON body for methods that are expected to have one
            const shouldParseBody = !(options.method === 'get' || options.method === 'delete');
            const body = shouldParseBody ? await ctx.req.json().catch(() => ({})) : {};
            const query =
                options.requestQuery && Object.keys(options.requestQuery).length > 0
                    ? // biome-ignore lint/suspicious/noExplicitAny: Hono validation returns transformed data
                      (ctx.req as any).valid('query')
                    : {};

            const result = await options.handler(ctx, params, body, query);
            return createResponse(result, ctx, 200);
        } catch (error) {
            return handleRouteError(error, ctx);
        }
    });

    return app;
};

/**
 * Helper function to create standardized list API responses with pagination
 * Reduces boilerplate for list endpoints that need pagination
 * Version 2.2 - Automatic pagination validation and unknown parameter rejection
 * Automatically converts z.date() schemas to OpenAPI-compatible string datetime
 * Automatically validates pagination parameters and rejects unknown query params
 */
export const createListRoute = (
    options: CreateOpenApiRouteInterface & {
        requestQuery?: Record<string, z.ZodTypeAny>; // Now optional - pagination is auto-added
        allowedQueryParams?: string[]; // Whitelist of additional allowed params
    }
) => {
    const app = createRouter();

    // Apply route-specific middlewares
    applyRouteMiddlewares(app, options.options);

    // Auto-merge pagination with custom query params
    const finalQuery = {
        ...PaginationQuerySchema.shape,
        ...(options.requestQuery || {})
    };

    // Calculate all allowed query parameter names
    const allowedParams = [
        ...Object.keys(PaginationQuerySchema.shape),
        ...Object.keys(options.requestQuery || {}),
        ...(options.allowedQueryParams || [])
    ];

    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        request: {
            params: options.requestParams ? createParamsRequest(options.requestParams) : undefined,
            query: createQueryRequest(finalQuery)
        },
        // Apply OpenAPI conversion to response schemas
        responses: ResponseFactory.createListResponses(createOpenAPISchema(options.responseSchema))
    });

    app.openapi(route, async (ctx) => {
        try {
            // Validate that only allowed query parameters are provided
            const rawQuery = ctx.req.query();
            const providedParams = Object.keys(rawQuery);
            const invalidParams = providedParams.filter((param) => !allowedParams.includes(param));

            if (invalidParams.length > 0) {
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: ServiceErrorCode.INVALID_PAGINATION_PARAMS,
                            message: 'Invalid pagination parameters provided'
                        }
                    },
                    400
                );
            }

            // ✅ Use proper validation for query parameters (they get transformed by Zod)
            const params = ctx.req.param() || {};
            // biome-ignore lint/suspicious/noExplicitAny: Hono validation returns transformed data
            const query = (ctx.req as any).valid('query');

            const result = await options.handler(ctx, params, {}, query);

            // ✅ Better type checking for result structure
            if (!result || typeof result !== 'object') {
                throw new Error('Handler must return a valid paginated result object');
            }

            const typedResult = result as PaginatedResult;

            if (!typedResult.items || !typedResult.pagination) {
                throw new Error('Paginated result must have items and pagination properties');
            }

            return createPaginatedResponse(typedResult.items, typedResult.pagination, ctx, 200);
        } catch (error) {
            return handleRouteError(error, ctx);
        }
    });

    return app;
};
