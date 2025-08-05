/**
 * Route factory for creating common API routes
 * Provides helper functions to create CRUD and list routes with consistent structure
 */

import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import createApp from './create-app';
import { ResponseFactory } from './response-factory';
import {
    type PaginatedResult,
    createPaginatedResponse,
    createResponse,
    handleRouteError
} from './response-helpers';

/**
 * Interface for creating OpenAPI routes with standardized structure
 */
export interface CreateOpenApiRouteInterface {
    method: 'get' | 'post' | 'put' | 'delete';
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
}

/**
 * Interface for request options configuration
 */
interface CreateRequestOptionsInterface {
    params: Record<string, z.ZodTypeAny>;
    body: z.ZodTypeAny;
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
 * Helper function to create CRUD routes with standardized structure
 * Provides a consistent interface for all CRUD operations
 */
export const createCRUDRoute = (options: CreateOpenApiRouteInterface) => {
    const app = createApp();
    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        request: createRequestOptions({
            params: options.requestParams || {},
            body: options.requestBody || z.object({}),
            query: options.requestQuery || {}
        }),
        responses: ResponseFactory.createCRUDResponses(options.responseSchema)
    });

    app.openapi(route, async (ctx) => {
        try {
            const params = ctx.req.valid('param' as never);
            const body = ctx.req.valid('json' as never);
            const result = await options.handler(ctx, params, body);
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
 */
export const createListRoute = (
    options: CreateOpenApiRouteInterface & {
        requestQuery: Record<string, z.ZodTypeAny>;
    }
) => {
    const app = createApp();
    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        request: {
            params: options.requestParams ? createParamsRequest(options.requestParams) : undefined,
            query: createQueryRequest(options.requestQuery)
        },
        responses: ResponseFactory.createListResponses(options.responseSchema)
    });

    app.openapi(route, async (ctx) => {
        try {
            const params = ctx.req.valid('param' as never);
            const query = ctx.req.valid('query' as never);
            const result = await options.handler(
                ctx,
                params as Record<string, unknown>,
                {} as Record<string, unknown>,
                query as Record<string, unknown>
            );

            // Type assertion for the result structure
            const typedResult = result as PaginatedResult;

            return createPaginatedResponse(typedResult.items, typedResult.pagination, ctx, 200);
        } catch (error) {
            return handleRouteError(error, ctx);
        }
    });

    return app;
};
