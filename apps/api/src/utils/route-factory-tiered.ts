/**
 * Three-tier authorization route factories (Public, Protected, Admin)
 * plus the API-key tier for machine callers (Custom GPT, Make.com).
 * Extracted from route-factory.ts to keep each file under 500 lines.
 * All symbols are re-exported from route-factory.ts so importers are unaffected.
 */

import type { z } from '@hono/zod-openapi';
import type { PermissionEnum } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import {
    type ApiKeyActorIdentity,
    type ApiKeyMiddlewareConfig,
    apiKeyMiddleware
} from '../middlewares/api-key';
import {
    adminAuthMiddleware,
    protectedAuthMiddleware,
    publicAuthMiddleware
} from '../middlewares/authorization';
import { ownershipMiddleware } from '../middlewares/ownership';
import type { OwnershipConfig } from '../types/authorization';
import type { CreateOpenApiRouteInterface } from './route-factory';
import { createCRUDRoute, createListRoute } from './route-factory';

// ============================================================================
// Three-Tier Authorization Route Factories
// ============================================================================

/**
 * Interface for public route options
 */
export interface PublicRouteOptions extends CreateOpenApiRouteInterface {
    /** Override default tags to include "Public" prefix */
    publicTag?: boolean;
}

/**
 * Interface for protected route options
 */
export interface ProtectedRouteOptions extends CreateOpenApiRouteInterface {
    /** Required permissions for this route */
    requiredPermissions?: PermissionEnum[];
    /** Ownership configuration for resource access */
    ownership?: OwnershipConfig;
    /** Override default tags to include "Protected" prefix */
    protectedTag?: boolean;
}

/**
 * Interface for admin route options
 */
export interface AdminRouteOptions extends CreateOpenApiRouteInterface {
    /** Required admin permissions for this route */
    requiredPermissions?: PermissionEnum[];
    /** Override default tags to include "Admin" prefix */
    adminTag?: boolean;
}

/**
 * Creates a public route (no authentication required)
 * Routes created with this factory allow both guests and authenticated users
 *
 * @example
 * export const listAccommodationsRoute = createPublicRoute({
 *   method: 'get',
 *   path: '/',
 *   summary: 'List accommodations',
 *   description: 'Returns a paginated list of accommodations',
 *   tags: ['Accommodations'],
 *   responseSchema: AccommodationSchema,
 *   handler: async (ctx, params, body, query) => {
 *     const service = new AccommodationService({ logger: apiLogger });
 *     return service.list(getActorFromContext(ctx), query);
 *   }
 * });
 */
export const createPublicRoute = (options: PublicRouteOptions) => {
    const { publicTag = true, ...routeOptions } = options;

    // Add Public tag prefix if enabled
    const tags = publicTag
        ? options.tags.map((tag) => (tag.startsWith('Public') ? tag : `Public - ${tag}`))
        : options.tags;

    return createCRUDRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: true,
            middlewares: [publicAuthMiddleware(), ...(routeOptions.options?.middlewares || [])]
        }
    });
};

/**
 * Creates a protected route (authentication required)
 * Routes created with this factory require the user to be authenticated (no guests)
 * Optionally enforces ownership for resource-specific operations
 *
 * @example
 * export const updateAccommodationRoute = createProtectedRoute({
 *   method: 'put',
 *   path: '/{id}',
 *   summary: 'Update accommodation',
 *   description: 'Updates an accommodation',
 *   tags: ['Accommodations'],
 *   requestParams: { id: z.string().uuid() },
 *   requestBody: AccommodationUpdateSchema,
 *   responseSchema: AccommodationSchema,
 *   ownership: {
 *     entityType: 'accommodation',
 *     ownershipFields: ['ownerId', 'createdById'],
 *     bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
 *   },
 *   handler: async (ctx, params, body) => {
 *     const service = new AccommodationService({ logger: apiLogger });
 *     return service.update(getActorFromContext(ctx), params.id, body);
 *   }
 * });
 */
export const createProtectedRoute = (options: ProtectedRouteOptions) => {
    const { protectedTag = true, requiredPermissions, ownership, ...routeOptions } = options;

    // Add Protected tag prefix if enabled
    const tags = protectedTag
        ? options.tags.map((tag) => (tag.startsWith('Protected') ? tag : `Protected - ${tag}`))
        : options.tags;

    // Build middleware chain
    const middlewares: MiddlewareHandler[] = [
        protectedAuthMiddleware(requiredPermissions),
        ...(routeOptions.options?.middlewares || [])
    ];

    // Add ownership middleware if configured
    if (ownership) {
        middlewares.push(ownershipMiddleware(ownership));
    }

    return createCRUDRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: false,
            middlewares
        }
    });
};

/**
 * Creates an admin route (admin permissions required)
 * Routes created with this factory require admin-level access
 *
 * @example
 * export const hardDeleteAccommodationRoute = createAdminRoute({
 *   method: 'delete',
 *   path: '/{id}/hard',
 *   summary: 'Hard delete accommodation',
 *   description: 'Permanently deletes an accommodation',
 *   tags: ['Accommodations'],
 *   requestParams: { id: z.string().uuid() },
 *   responseSchema: z.null(),
 *   requiredPermissions: [PermissionEnum.ACCOMMODATION_HARD_DELETE],
 *   handler: async (ctx, params) => {
 *     const service = new AccommodationService({ logger: apiLogger });
 *     return service.hardDelete(getActorFromContext(ctx), params.id);
 *   }
 * });
 */
export const createAdminRoute = (options: AdminRouteOptions) => {
    const { adminTag = true, requiredPermissions, ...routeOptions } = options;

    // Add Admin tag prefix if enabled
    const tags = adminTag
        ? options.tags.map((tag) => (tag.startsWith('Admin') ? tag : `Admin - ${tag}`))
        : options.tags;

    return createCRUDRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: false,
            middlewares: [
                adminAuthMiddleware(requiredPermissions),
                ...(routeOptions.options?.middlewares || [])
            ]
        }
    });
};

// ============================================================================
// Three-Tier Authorization List Route Factories
// ============================================================================

/**
 * Interface for public list route options
 */
export interface PublicListRouteOptions extends CreateOpenApiRouteInterface {
    requestQuery?: Record<string, z.ZodTypeAny>;
    allowedQueryParams?: string[];
    publicTag?: boolean;
}

/**
 * Interface for protected list route options
 */
export interface ProtectedListRouteOptions extends CreateOpenApiRouteInterface {
    requestQuery?: Record<string, z.ZodTypeAny>;
    allowedQueryParams?: string[];
    requiredPermissions?: PermissionEnum[];
    protectedTag?: boolean;
}

/**
 * Interface for admin list route options
 */
export interface AdminListRouteOptions extends CreateOpenApiRouteInterface {
    requestQuery?: Record<string, z.ZodTypeAny>;
    allowedQueryParams?: string[];
    requiredPermissions?: PermissionEnum[];
    adminTag?: boolean;
}

/**
 * Creates a public list route with pagination (no authentication required)
 *
 * @example
 * export const listAccommodationsRoute = createPublicListRoute({
 *   method: 'get',
 *   path: '/',
 *   summary: 'List accommodations',
 *   description: 'Returns a paginated list of public accommodations',
 *   tags: ['Accommodations'],
 *   requestQuery: AccommodationSearchSchema.shape,
 *   responseSchema: AccommodationSchema,
 *   handler: async (ctx, params, body, query) => {
 *     const service = new AccommodationService({ logger: apiLogger });
 *     const result = await service.list(getActorFromContext(ctx), query);
 *     return { items: result.data.items, pagination: result.data.pagination };
 *   }
 * });
 */
export const createPublicListRoute = (options: PublicListRouteOptions) => {
    const { publicTag = true, ...routeOptions } = options;

    // Add Public tag prefix if enabled
    const tags = publicTag
        ? options.tags.map((tag) => (tag.startsWith('Public') ? tag : `Public - ${tag}`))
        : options.tags;

    return createListRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: true,
            middlewares: [publicAuthMiddleware(), ...(routeOptions.options?.middlewares || [])]
        }
    });
};

/**
 * Creates a protected list route with pagination (authentication required)
 *
 * @example
 * export const listMyAccommodationsRoute = createProtectedListRoute({
 *   method: 'get',
 *   path: '/my',
 *   summary: 'List my accommodations',
 *   description: 'Returns a paginated list of accommodations owned by the current user',
 *   tags: ['Accommodations'],
 *   responseSchema: AccommodationSchema,
 *   handler: async (ctx, params, body, query) => {
 *     const actor = getActorFromContext(ctx);
 *     const service = new AccommodationService({ logger: apiLogger });
 *     const result = await service.listByOwner(actor, actor.id, query);
 *     return { items: result.data.items, pagination: result.data.pagination };
 *   }
 * });
 */
export const createProtectedListRoute = (options: ProtectedListRouteOptions) => {
    const { protectedTag = true, requiredPermissions, ...routeOptions } = options;

    // Add Protected tag prefix if enabled
    const tags = protectedTag
        ? options.tags.map((tag) => (tag.startsWith('Protected') ? tag : `Protected - ${tag}`))
        : options.tags;

    return createListRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: false,
            middlewares: [
                protectedAuthMiddleware(requiredPermissions),
                ...(routeOptions.options?.middlewares || [])
            ]
        }
    });
};

/**
 * Creates an admin list route with pagination (admin permissions required)
 * Admin list routes typically include deleted/hidden items
 *
 * @example
 * export const listAllAccommodationsRoute = createAdminListRoute({
 *   method: 'get',
 *   path: '/',
 *   summary: 'List all accommodations (admin)',
 *   description: 'Returns a paginated list of all accommodations including deleted ones',
 *   tags: ['Accommodations'],
 *   requestQuery: { includeDeleted: z.boolean().optional() },
 *   responseSchema: AccommodationAdminSchema,
 *   handler: async (ctx, params, body, query) => {
 *     const service = new AccommodationService({ logger: apiLogger });
 *     const result = await service.listAll(getActorFromContext(ctx), query);
 *     return { items: result.data.items, pagination: result.data.pagination };
 *   }
 * });
 */
export const createAdminListRoute = (options: AdminListRouteOptions) => {
    const { adminTag = true, requiredPermissions, ...routeOptions } = options;

    // Add Admin tag prefix if enabled
    const tags = adminTag
        ? options.tags.map((tag) => (tag.startsWith('Admin') ? tag : `Admin - ${tag}`))
        : options.tags;

    return createListRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: false,
            middlewares: [
                adminAuthMiddleware(requiredPermissions),
                ...(routeOptions.options?.middlewares || [])
            ]
        }
    });
};

// ============================================================================
// API-Key Route Factory (machine callers: Custom GPT, Make.com)
// ============================================================================

/**
 * Configuration for an API-key authenticated route.
 * Extends the standard OpenAPI route interface with the API-key security config.
 */
export interface ApiKeyRouteOptions extends CreateOpenApiRouteInterface {
    /**
     * API-key middleware configuration.
     *
     * - headerName: header the caller sends the key in (e.g. 'x-hospeda-ai-key')
     * - getExpectedKey: function returning the expected key from env (called per request)
     * - actor: stable machine identity to inject into context on auth success
     *
     * @example
     * ```typescript
     * apiKeyConfig: {
     *   headerName: 'x-hospeda-ai-key',
     *   getExpectedKey: () => env.HOSPEDA_AI_SOCIAL_KEY,
     *   actor: { id: 'gpt-action', name: 'Custom GPT Social Action' },
     * }
     * ```
     */
    readonly apiKeyConfig: ApiKeyMiddlewareConfig;
    /**
     * Override default tag prefix. When true (default) tags are prefixed
     * with 'AI - ' for GPT routes or any prefix the caller sets via tags.
     * Set to false to use tags as-is.
     */
    readonly apiKeyTag?: boolean;
}

/**
 * Configuration for an API-key authenticated list route (with pagination).
 */
export interface ApiKeyListRouteOptions extends CreateOpenApiRouteInterface {
    requestQuery?: Record<string, z.ZodTypeAny>;
    allowedQueryParams?: string[];
    readonly apiKeyConfig: ApiKeyMiddlewareConfig;
    readonly apiKeyTag?: boolean;
}

/**
 * Creates a route authenticated via a static inbound API key.
 * Designed for machine-to-machine callers (Custom GPT, Make.com webhooks).
 *
 * Does NOT run the session authMiddleware / actorMiddleware chain.
 * Instead, injects a synthetic SYSTEM-role actor via apiKeyMiddleware.
 *
 * Rate limiting falls through to the 'general' bucket by default.
 * For dedicated buckets pass `customRateLimit` in the route options.
 * NOTE: /api/v1/ai/* and /api/v1/integrations/make/* paths are intentionally
 * left to the 'general' bucket for now — add explicit buckets in
 * getEndpointType() when call volumes justify it (see T-026 notes).
 *
 * @example
 * ```typescript
 * export const draftPostRoute = createApiKeyRoute({
 *   method: 'post',
 *   path: '/draft',
 *   summary: 'Draft a social post',
 *   description: 'Custom GPT drafts a social post for operator review',
 *   tags: ['AI - Social'],
 *   apiKeyConfig: {
 *     headerName: 'x-hospeda-ai-key',
 *     getExpectedKey: () => env.HOSPEDA_AI_SOCIAL_KEY,
 *     actor: { id: 'gpt-action', name: 'Custom GPT Social Action' },
 *   },
 *   requestBody: DraftPostSchema,
 *   responseSchema: SocialPostDraftSchema,
 *   handler: async (ctx, _params, body) => {
 *     return socialDraftService.create(getActorFromContext(ctx), body);
 *   },
 * });
 * ```
 */
export const createApiKeyRoute = (options: ApiKeyRouteOptions) => {
    const { apiKeyConfig, apiKeyTag = false, ...routeOptions } = options;

    // Tags: when apiKeyTag=true (opt-in) prefix untagged items — callers
    // typically set their own descriptive tags ('AI - Social', etc.) already.
    const tags = apiKeyTag
        ? options.tags.map((tag) =>
              tag.startsWith('AI -') || tag.startsWith('Integrations -') ? tag : `AI - ${tag}`
          )
        : options.tags;

    const middlewares: MiddlewareHandler[] = [
        apiKeyMiddleware(apiKeyConfig),
        ...(routeOptions.options?.middlewares ?? [])
    ];

    return createCRUDRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            // Skip the Better Auth session middleware — machine callers have no session.
            skipAuth: true,
            middlewares
        }
    });
};

/**
 * Creates a list (paginated) route authenticated via a static inbound API key.
 * Mirror of createApiKeyRoute for endpoints that return paginated collections.
 *
 * @example
 * ```typescript
 * export const listDraftsRoute = createApiKeyListRoute({
 *   method: 'get',
 *   path: '/drafts',
 *   summary: 'List social post drafts',
 *   tags: ['AI - Social'],
 *   apiKeyConfig: { ... },
 *   requestQuery: { status: z.enum(['pending', 'approved']).optional() },
 *   responseSchema: SocialPostDraftSchema,
 *   handler: async (ctx, _params, _body, query) => {
 *     return socialDraftService.list(getActorFromContext(ctx), query);
 *   },
 * });
 * ```
 */
export const createApiKeyListRoute = (options: ApiKeyListRouteOptions) => {
    const { apiKeyConfig, apiKeyTag = false, ...routeOptions } = options;

    const tags = apiKeyTag
        ? options.tags.map((tag) =>
              tag.startsWith('AI -') || tag.startsWith('Integrations -') ? tag : `AI - ${tag}`
          )
        : options.tags;

    const middlewares: MiddlewareHandler[] = [
        apiKeyMiddleware(apiKeyConfig),
        ...(routeOptions.options?.middlewares ?? [])
    ];

    return createListRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: true,
            middlewares
        }
    });
};

// Re-export the identity type so route files can import it from one place.
export type { ApiKeyActorIdentity, ApiKeyMiddlewareConfig };

// ============================================================================
// Streaming Route Factory (SSE) — re-exported here for discoverability
// ============================================================================

export {
    createProtectedStreamingRoute,
    createStreamingRoute
} from './streaming-route-factory';
export type {
    ProtectedStreamingRouteOptions,
    StreamHandlerContext,
    StreamHandlerResult,
    StreamTextChunk,
    StreamingRouteOptions
} from './streaming-route-factory';
