/**
 * Basic CRUD Example - Route Layer
 *
 * This file demonstrates how to create Hono API routes for a CRUD entity
 * using the Hospeda route factory pattern. It builds upon the Category
 * service from service.ts.
 *
 * Key Concepts:
 * - Using createCRUDRoute factory for type-safe routes
 * - OpenAPI documentation integration
 * - Request/response validation with Zod schemas
 * - Actor-based authentication and authorization
 * - Service integration pattern
 * - Error handling in routes
 *
 * @see apps/api/src/routes/destination/create.ts - Real example
 * @see apps/api/src/routes/destination/update.ts - Update example
 * @see apps/api/src/utils/route-factory.ts - Route factory implementation
 */

import type { CategoryIdType } from '@repo/schemas';
import {
    CategoryCreateInputSchema,
    CategoryQuerySchema,
    CategorySchema,
    CategoryUpdateInputSchema
} from '@repo/schemas';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import { CategoryService } from './service';

// Initialize service instance (reused across all routes)
const categoryService = new CategoryService({ logger: apiLogger });

/**
 * CREATE - POST /categories
 *
 * Creates a new category.
 * Requires authentication and CREATE permission.
 *
 * Request body example:
 * {
 *   "name": "Beach Destinations",
 *   "slug": "beach-destinations",
 *   "description": "Beautiful beaches along the coast"
 * }
 *
 * Response example (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cat_abc123",
 *     "name": "Beach Destinations",
 *     "slug": "beach-destinations",
 *     "description": "Beautiful beaches along the coast",
 *     "createdAt": "2024-01-15T10:30:00Z",
 *     "updatedAt": "2024-01-15T10:30:00Z",
 *     ...
 *   }
 * }
 */
export const createCategoryRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create category',
    description: 'Creates a new category',
    tags: ['Categories'],
    requestBody: CategoryCreateInputSchema,
    responseSchema: CategorySchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        // Extract actor from context (contains user info, role, permissions)
        const actor = getActorFromContext(ctx);

        // Call service with actor and validated body
        const result = await categoryService.create(actor, body as never);

        // Handle service errors
        if (result.error) {
            throw new Error(result.error.message);
        }

        // Return created entity
        return result.data;
    }
    // Auth is required by default, no need to specify
});

/**
 * READ - GET /categories/{id}
 *
 * Retrieves a single category by ID.
 * Public endpoint (no authentication required).
 *
 * Response example (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cat_abc123",
 *     "name": "Beach Destinations",
 *     ...
 *   }
 * }
 *
 * Error example (404 Not Found):
 * {
 *   "success": false,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Category not found"
 *   }
 * }
 */
export const getCategoryByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get category by ID',
    description: 'Retrieves a single category by its ID',
    tags: ['Categories'],
    requestParams: {
        id: CategorySchema.shape.id // Use schema shape for type safety
    },
    responseSchema: CategorySchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as CategoryIdType;

        const result = await categoryService.getById(actor, id);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        skipAuth: true // Make this endpoint public
    }
});

/**
 * LIST - GET /categories
 *
 * Lists all categories with pagination and filtering.
 * Public endpoint.
 *
 * Query parameters example:
 * ?page=1&pageSize=10&name=beach&isActive=true
 *
 * Response example (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "items": [...],
 *     "pagination": {
 *       "page": 1,
 *       "pageSize": 10,
 *       "total": 45,
 *       "totalPages": 5
 *     }
 *   }
 * }
 */
export const listCategoriesRoute = createCRUDRoute({
    method: 'get',
    path: '/',
    summary: 'List categories',
    description: 'Returns a paginated list of categories with optional filters',
    tags: ['Categories'],
    requestQuery: CategoryQuerySchema.optional(),
    responseSchema: CategorySchema.array(),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await categoryService.list(actor, query ?? {});

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: {
        skipAuth: true
    }
});

/**
 * UPDATE - PUT /categories/{id}
 *
 * Updates all fields of a category (full update).
 * Requires authentication and UPDATE permission.
 *
 * Request body example:
 * {
 *   "name": "Updated Beach Destinations",
 *   "slug": "updated-beach-destinations",
 *   "description": "New description",
 *   "isActive": true
 * }
 *
 * Response example (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cat_abc123",
 *     "name": "Updated Beach Destinations",
 *     ...
 *   }
 * }
 */
export const updateCategoryRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update category',
    description: 'Updates all fields of a category',
    tags: ['Categories'],
    requestParams: {
        id: CategorySchema.shape.id
    },
    requestBody: CategoryUpdateInputSchema,
    responseSchema: CategorySchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as CategoryIdType;

        const result = await categoryService.update(actor, id, body as never);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

/**
 * SOFT DELETE - DELETE /categories/{id}
 *
 * Soft deletes a category (marks as deleted, preserves data).
 * Requires authentication and DELETE permission.
 *
 * Response example (204 No Content)
 */
export const softDeleteCategoryRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete category',
    description: 'Marks a category as deleted (soft delete)',
    tags: ['Categories'],
    requestParams: {
        id: CategorySchema.shape.id
    },
    responseSchema: CategorySchema.pick({ id: true }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as CategoryIdType;

        const result = await categoryService.softDelete(actor, id);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return { id: result.data };
    }
});

/**
 * RESTORE - POST /categories/{id}/restore
 *
 * Restores a soft-deleted category.
 * Requires authentication and ADMIN role.
 *
 * Response example (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cat_abc123",
 *     ...
 *   }
 * }
 */
export const restoreCategoryRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore category',
    description: 'Restores a soft-deleted category',
    tags: ['Categories'],
    requestParams: {
        id: CategorySchema.shape.id
    },
    responseSchema: CategorySchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as CategoryIdType;

        const result = await categoryService.restore(actor, id);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

/**
 * Route Registration Example
 *
 * In routes/category/index.ts:
 *
 * import { createRouter } from '../../utils/create-app';
 * import {
 *   createCategoryRoute,
 *   getCategoryByIdRoute,
 *   listCategoriesRoute,
 *   updateCategoryRoute,
 *   softDeleteCategoryRoute,
 *   restoreCategoryRoute
 * } from './route';
 *
 * const app = createRouter();
 *
 * // Public routes
 * app.route('/', listCategoriesRoute);
 * app.route('/', getCategoryByIdRoute);
 *
 * // Protected routes
 * app.route('/', createCategoryRoute);
 * app.route('/', updateCategoryRoute);
 * app.route('/', softDeleteCategoryRoute);
 * app.route('/', restoreCategoryRoute);
 *
 * export { app as categoryRoutes };
 */
