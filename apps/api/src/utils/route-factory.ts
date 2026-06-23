/** Route factory for creating common API routes with consistent structure */

import { createRoute, z } from '@hono/zod-openapi';
import type { PermissionEnum } from '@repo/schemas';
import { PaginationQuerySchema, ServiceErrorCode } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { createPerRouteRateLimitMiddleware } from '../middlewares/rate-limit';
import type { AuthorizationLevel, OwnershipConfig } from '../types/authorization';
import { createRouter } from './create-app';
import { createOpenAPISchema } from './openapi-schema';
import { ResponseFactory } from './response-factory';
import {
    type PaginatedResult,
    assertConcretePublicSchema,
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
    /** Authorization level for the route (public, protected, admin) */
    authorizationLevel?: AuthorizationLevel;
    /** Required permissions for the route */
    requiredPermissions?: PermissionEnum[];
    /** Ownership configuration for protected routes */
    ownership?: OwnershipConfig;
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
    /**
     * Zod schema that all routes MUST declare (SPEC-210 PR5).
     * Passed to {@link createResponse} to strip sensitive fields before
     * serialization. Must be a concrete schema — not `z.any()`, `z.unknown()`,
     * `z.record()` at the top level, or `z.object({}).passthrough()`.
     */
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
    /**
     * Zod schema that every route MUST declare.
     * Used by {@link createResponse} and {@link createPaginatedResponse} to strip
     * unknown / admin-only fields before the response is serialized (SPEC-062).
     *
     * SPEC-210 PR5 — omitting this field is a compile error. At runtime,
     * {@link stripWithSchema} throws `ServiceError(INTERNAL_ERROR)` when no
     * schema is supplied, so a missing declaration fails fast rather than
     * silently leaking fields.
     *
     * Must be a concrete schema (not `z.any()`, `z.unknown()`, `z.record()` at
     * the top level, or `z.object({}).passthrough()`). Use
     * {@link assertConcretePublicSchema} to enforce this at boot time.
     */
    responseSchema: z.ZodTypeAny;
    /**
     * Override the success HTTP status code returned by the handler.
     *
     * When unset the factory uses the standard mapping:
     *   - POST → 201 Created
     *   - DELETE → 204 (empty) or 200 (with body)
     *   - others → 200 OK
     *
     * Set this for routes that should break the default (e.g. media uploads
     * return 200 OK because an upload may overwrite an existing asset and
     * therefore is not strictly a creation — SPEC-078-GAPS T-029).
     *
     * Only 200 and 201 are supported here because `createResponse()` only
     * types those two codes.
     */
    successStatusCode?: 200 | 201;
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
 * Helper function to check if a single schema field has coercion enabled
 * Recursively unwraps ZodOptional, ZodNullable, ZodDefault, etc. to find the inner type
 */
const hasCoercion = (fieldSchema: z.ZodTypeAny): boolean => {
    // Zod does not expose a public API for checking coercion on arbitrary schema types.
    // The only way to detect z.coerce.number() vs z.number() is via the internal _def.coerce flag.
    // biome-ignore lint/suspicious/noExplicitAny: Zod internal _def access for schema introspection
    const def = (fieldSchema as any)._def;

    // Direct coercion check (z.coerce.number(), z.coerce.date(), etc.)
    if (def?.coerce === true) {
        return true;
    }

    // Check for wrapped types (ZodOptional, ZodNullable, ZodDefault, etc.)
    // These store the inner schema in innerType or schema
    const innerSchema = def?.innerType || def?.schema;
    if (innerSchema) {
        return hasCoercion(innerSchema);
    }

    return false;
};

/**
 * Helper function to check if a schema has HTTP-specific coercion fields
 * (e.g., z.coerce.date(), z.coerce.number())
 * These schemas should NOT be processed by createOpenAPISchema as they need
 * their coercion logic preserved for runtime validation
 */
const hasHttpCoercionFields = (schema: z.ZodTypeAny): boolean => {
    if (!(schema instanceof z.ZodObject)) {
        return false;
    }

    // Check if any field in the schema has coercion enabled (including wrapped types)
    for (const [_fieldName, fieldSchema] of Object.entries(schema.shape)) {
        const hasCoercionResult = hasCoercion(fieldSchema as z.ZodTypeAny);
        if (hasCoercionResult) {
            return true;
        }
    }

    return false;
};

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
 * Convert an OpenAPI path expression (`/{id}`, `/users/{userId}/posts/{postId}`)
 * to Hono's Express-style path expression (`/:id`, `/users/:userId/posts/:postId`).
 *
 * The route file defines paths using OpenAPI syntax because that's what the
 * `@hono/zod-openapi` `createRoute()` factory expects. But `app.use(path, mw)`
 * is a plain Hono call that treats `{id}` literally — it would only fire when
 * the URL pathname is the literal string `/{id}`, never for actual values.
 * Converting to `:id` here lets the same path string serve both routing and
 * middleware scoping.
 */
const openApiPathToHonoPath = (openApiPath: string): string =>
    openApiPath.replace(/\{([^}]+)\}/g, ':$1');

/**
 * Helper function to apply route-specific middlewares.
 *
 * **Path-scoping is mandatory.** Each route-factory call creates a fresh
 * sub-app via `createRouter()` that hosts exactly ONE route. When that
 * sub-app is later mounted into a parent via `app.route('/api/v1/public', subApp)`,
 * Hono treats unscoped `app.use(mw)` on the sub-app as "apply this middleware
 * to every request reaching the parent's mount prefix" — not just to the
 * sub-app's single route. With multiple sibling sub-apps mounted at the
 * SAME prefix (e.g. `contactRoutes`, `newsletterRoutes`, and
 * `publicStatsRoutes` all under `/api/v1/public`), each sub-app's
 * `app.use(mw)` leaks to its siblings' paths. The observed effect: a
 * request to `/api/v1/public/stats` triggers the per-route rate limits of
 * `/contact/submit` (5/min) and `/newsletter/submit` (3/min), tripping a
 * 429 after three completely unrelated requests.
 *
 * Passing `routePath` (the OpenAPI path string from the route definition,
 * e.g. `/`, `/{id}`, `/me/stats`) to `app.use()` after converting it to
 * Hono syntax (`/:id`, `/me/stats`) scopes the middleware to just that
 * path within the sub-app, breaking the leak.
 */
const applyRouteMiddlewares = (
    app: ReturnType<typeof createRouter>,
    options: RouteOptions | undefined,
    routePath: string
) => {
    const honoPath = openApiPathToHonoPath(routePath);

    // Apply per-route rate limiting BEFORE other middlewares
    if (options?.customRateLimit) {
        app.use(
            honoPath,
            createPerRouteRateLimitMiddleware({
                requests: options.customRateLimit.requests,
                windowMs: options.customRateLimit.windowMs
            })
        );
    }

    if (options?.middlewares) {
        for (const middleware of options.middlewares) {
            app.use(honoPath, middleware);
        }
    }

    // Add route-specific options as context for middlewares to use
    if (options) {
        app.use(honoPath, async (c: Context, next: () => Promise<void>) => {
            // Store route options as a non-standard property on the context object.
            // Route validators and guards read this to determine per-route behavior
            // (e.g. skipValidation). There is no ContextVariableMap entry for this
            // because the value is attached before the typed variables are set.
            // TYPE-WORKAROUND: routeOptions is stored as a non-standard ctx property (read by validation/cache/auth middlewares) before typed variables are set; cast widens to a writable record since no ContextVariableMap entry exists.
            (c as unknown as Record<string, unknown>).routeOptions = options;
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

    // Security headers (HSTS, X-Frame-Options, CSP, etc.) are applied globally
    // by securityHeadersMiddleware in security.ts (registered in create-app.ts).
    // No per-route secureHeaders() call is needed here.
};

/**
 * Helper function to create simple routes (like health checks, version endpoints)
 * Reduces boilerplate for endpoints that don't need complex validation
 * Automatically converts z.date() schemas to OpenAPI-compatible string datetime
 */
export const createSimpleRoute = (options: SimpleRouteInterface) => {
    // SPEC-210 PR5 (T-004): fail at boot if the responseSchema is a
    // permissive/passthrough schema that would leak internal fields. Simple
    // routes are public/system-tier, so the same public-response contract
    // applies. Runs once per route at construction time, never per request.
    assertConcretePublicSchema(options.responseSchema);

    const app = createRouter();

    // Apply route-specific middlewares
    applyRouteMiddlewares(app, options.options, options.path);

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
            return createResponse(result, ctx, 200, options.responseSchema);
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
    applyRouteMiddlewares(app, options.options, options.path);

    const route = createRoute({
        method: options.method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        request: createRequestOptions({
            params: options.requestParams || {},
            // Do not declare a body for GET/DELETE requests to avoid JSON parsing on empty bodies
            // HTTP schemas (with refinements or coercion) don't need OpenAPI conversion
            body:
                options.method === 'get' || options.method === 'delete'
                    ? undefined
                    : options.requestBody
                      ? // Skip createOpenAPISchema for:
                        // 1. ZodEffects (schemas with .refine()) - need validations preserved
                        // 2. Schemas with coercion fields (z.coerce.date(), z.coerce.number()) - need coercion preserved
                        // Zod provides no instanceof check for ZodEffects; typeName is the only discriminant.
                        // biome-ignore lint/suspicious/noExplicitAny: Zod internal _def access for ZodEffects detection
                        (options.requestBody as any)._def?.typeName === 'ZodEffects' ||
                        hasHttpCoercionFields(options.requestBody)
                          ? options.requestBody
                          : createOpenAPISchema(options.requestBody)
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
                    ? // Hono's .valid() requires route-specific type params that are unavailable in a generic factory.
                      // biome-ignore lint/suspicious/noExplicitAny: Hono ctx.req.valid() type narrowing not available in generic context
                      (ctx.req as any).valid('param')
                    : ctx.req.param() || {};
            // Only parse JSON body when the method expects one AND a
            // `requestBody` schema is declared. Calling `ctx.req.json()`
            // consumes the raw body stream, which breaks handlers that need
            // to read the body themselves (e.g. multipart/form-data uploads).
            // Routes without a JSON schema receive `body = {}` and must
            // consume the body via `ctx.req.formData()` / `ctx.req.raw.clone()`
            // inside the handler (SPEC-078-GAPS T-029).
            const shouldParseBody = !(options.method === 'get' || options.method === 'delete');
            const body =
                shouldParseBody && options.requestBody
                    ? // Hono's .valid() requires route-specific type params that are unavailable in a generic factory.
                      // biome-ignore lint/suspicious/noExplicitAny: Hono ctx.req.valid() type narrowing not available in generic context
                      (ctx.req as any).valid('json')
                    : {};
            const query =
                options.requestQuery && Object.keys(options.requestQuery).length > 0
                    ? // Hono's .valid() requires route-specific type params that are unavailable in a generic factory.
                      // biome-ignore lint/suspicious/noExplicitAny: Hono ctx.req.valid() type narrowing not available in generic context
                      (ctx.req as any).valid('query')
                    : {};

            const result = await options.handler(ctx, params, body, query);
            // If handler returns a Response directly (e.g., for custom error handling), use it
            if (result instanceof Response) {
                return result;
            }

            // HTTP status codes based on method and result:
            // - POST: 201 Created
            // - DELETE: 204 No Content (when result is empty/null/undefined)
            // - DELETE: 200 OK (when returning deleted resource)
            // - Others: 200 OK
            if (options.method === 'delete') {
                // Return 204 No Content for successful DELETE with no body
                if (
                    result === undefined ||
                    result === null ||
                    (typeof result === 'object' && Object.keys(result as object).length === 0)
                ) {
                    return ctx.body(null, 204);
                }
                // Return 200 with body if DELETE returns content (e.g., deleted resource)
                return createResponse(result, ctx, 200, options.responseSchema);
            }

            // Per-route override takes precedence over the method default.
            // Media upload routes use this to return 200 instead of 201 because
            // an upload may overwrite an existing asset (SPEC-078-GAPS T-029).
            const defaultStatusCode = options.method === 'post' ? 201 : 200;
            const statusCode = options.successStatusCode ?? defaultStatusCode;
            return createResponse(result, ctx, statusCode, options.responseSchema);
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
    applyRouteMiddlewares(app, options.options, options.path);

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
            // biome-ignore lint/suspicious/noExplicitAny: Hono ctx.req.valid() type narrowing not available in generic context
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

            return createPaginatedResponse(
                typedResult.items,
                typedResult.pagination,
                ctx,
                200,
                options.responseSchema
            );
        } catch (error) {
            return handleRouteError(error, ctx);
        }
    });

    return app;
};
// Three-Tier Authorization Route Factories (re-exported from route-factory-tiered.ts)
export {
    createPublicRoute,
    createProtectedRoute,
    createAdminRoute,
    createPublicListRoute,
    createProtectedListRoute,
    createAdminListRoute,
    // Streaming SSE factories
    createStreamingRoute,
    createProtectedStreamingRoute
} from './route-factory-tiered';
export type {
    PublicRouteOptions,
    ProtectedRouteOptions,
    AdminRouteOptions,
    PublicListRouteOptions,
    ProtectedListRouteOptions,
    AdminListRouteOptions,
    // Streaming SSE types
    StreamingRouteOptions,
    ProtectedStreamingRouteOptions,
    StreamHandlerContext,
    StreamHandlerResult,
    StreamTextChunk
} from './route-factory-tiered';
