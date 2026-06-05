/**
 * Admin Add-on Definition Routes
 *
 * Full CRUD + lifecycle endpoints for add-on catalog management.
 * Add-ons are read from and written to the database via AddonCatalogService.
 *
 * Routes:
 * - GET    /api/v1/admin/billing/addons         - List add-on definitions (paginated + filtered)
 * - GET    /api/v1/admin/billing/addons/:id     - Get add-on by UUID
 * - POST   /api/v1/admin/billing/addons         - Create new add-on
 * - PUT    /api/v1/admin/billing/addons/:id     - Update add-on fields (slug immutable)
 * - PATCH  /api/v1/admin/billing/addons/:id     - Toggle add-on active state
 * - DELETE /api/v1/admin/billing/addons/:id     - Soft-delete add-on
 * - POST   /api/v1/admin/billing/addons/:id/restore - Restore soft-deleted add-on
 * - DELETE /api/v1/admin/billing/addons/:id/hard    - Hard-delete (blocked if referenced)
 *
 * Permissions (mirrors admin plans route):
 * - Read: PermissionEnum.BILLING_READ_ALL
 * - Write/lifecycle: PermissionEnum.BILLING_MANAGE
 *
 * Error mapping:
 * - 422 validation errors
 * - 404 not found
 * - 409 conflict (hard-delete guard)
 *
 * @module routes/billing/admin/addons
 */

import {
    AddonResponseSchema,
    AdminAddonListQuerySchema,
    AdminAddonResponseSchema,
    CreateAddonSchema,
    PermissionEnum,
    ServiceErrorCode,
    UpdateAddonSchema
} from '@repo/schemas';
import { AddonCatalogService } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';

/** Singleton catalog service instance */
const catalogService = new AddonCatalogService();

/**
 * Maps service error codes to HTTP status codes.
 */
function mapServiceErrorToStatus(code: string | undefined): 400 | 403 | 404 | 409 | 422 | 500 {
    const statusMap: Record<string, 400 | 403 | 404 | 409 | 422 | 500> = {
        [ServiceErrorCode.NOT_FOUND]: 404,
        [ServiceErrorCode.VALIDATION_ERROR]: 422,
        [ServiceErrorCode.FORBIDDEN]: 403,
        [ServiceErrorCode.ALREADY_EXISTS]: 409,
        [ServiceErrorCode.INTERNAL_ERROR]: 500
    };
    return statusMap[code ?? ''] ?? 500;
}

// ---------------------------------------------------------------------------
// Read endpoints — list + getById
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/billing/addons
 * List add-on definitions with pagination and optional filters.
 */
export const adminListAddonsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List add-on definitions (admin)',
    description:
        'Returns paginated add-on definitions from the database. Supports filtering by billing type, target category, active status, and free-text search. Unlike the public endpoint this returns all addons including inactive/deleted ones.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: AdminAddonListQuerySchema.shape,
    responseSchema: AdminAddonResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const filters = query as {
            billingType?: 'one_time' | 'recurring';
            targetCategory?: 'owner' | 'complex';
            isActive?: boolean;
            includeDeleted?: boolean;
            search?: string;
            page?: number;
            pageSize?: number;
        };

        apiLogger.debug({ filters }, 'Admin listing add-on definitions from DB');

        const result = await catalogService.listAdmin({
            billingType: filters.billingType,
            targetCategory: filters.targetCategory,
            isActive: filters.isActive,
            includeDeleted: filters.includeDeleted,
            search: filters.search,
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? 20
        });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to list add-ons'
            });
        }

        return {
            items: result.data.items,
            pagination: result.data.pagination
        };
    }
});

/**
 * GET /api/v1/admin/billing/addons/:id
 * Get a single add-on by UUID.
 */
export const adminGetAddonByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get add-on by ID (admin)',
    description:
        'Returns a single add-on by its UUID. Includes id, timestamps, and deletedAt status.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    responseSchema: AdminAddonResponseSchema,
    handler: async (_c, params) => {
        const id = params.id as string;
        apiLogger.debug({ addonId: id }, 'Admin getting add-on by ID from DB');

        const result = await catalogService.getById(id);

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Add-on not found'
            });
        }

        return result.data;
    }
});

// ---------------------------------------------------------------------------
// Write endpoints — create + update
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/addons
 * Create a new add-on definition. Returns the created add-on with id + timestamps.
 */
export const adminCreateAddonRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create add-on definition (admin)',
    description: 'Creates a new add-on definition. Slug is immutable after creation.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestBody: CreateAddonSchema,
    responseSchema: AddonResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const input = body as {
            slug: string;
            name: string;
            description: string;
            billingType: 'one_time' | 'recurring';
            priceArs: number;
            durationDays: number | null;
            affectsLimitKey: string | null;
            limitIncrease: number | null;
            grantsEntitlement: string | null;
            targetCategories: ('owner' | 'complex')[];
            isActive: boolean;
            sortOrder: number;
        };

        apiLogger.info({ slug: input.slug, actorId: actor.id }, 'Admin creating add-on definition');

        const result = await catalogService.create(
            {
                slug: input.slug,
                name: input.name,
                description: input.description,
                billingType: input.billingType,
                priceArs: input.priceArs,
                durationDays: input.durationDays,
                affectsLimitKey: input.affectsLimitKey,
                limitIncrease: input.limitIncrease,
                grantsEntitlement: input.grantsEntitlement,
                targetCategories: input.targetCategories,
                isActive: input.isActive,
                sortOrder: input.sortOrder
            },
            { actorId: actor.id }
        );

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to create add-on'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'billing_addon',
            resourceId: result.data.id
        });

        return result.data;
    }
});

/**
 * PUT /api/v1/admin/billing/addons/:id
 * Update mutable fields of an add-on. Slug is immutable.
 */
export const adminUpdateAddonRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update add-on definition (admin)',
    description:
        'Updates mutable fields of an add-on definition. Slug cannot be changed after creation.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    requestBody: UpdateAddonSchema,
    responseSchema: AddonResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ addonId: id, actorId: actor.id }, 'Admin updating add-on definition');

        const result = await catalogService.update(
            id,
            body as {
                name?: string;
                description?: string;
                billingType?: 'one_time' | 'recurring';
                priceArs?: number;
                durationDays?: number | null;
                affectsLimitKey?: string | null;
                limitIncrease?: number | null;
                grantsEntitlement?: string | null;
                targetCategories?: ('owner' | 'complex')[];
                isActive?: boolean;
                sortOrder?: number;
            },
            { actorId: actor.id }
        );

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to update add-on'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_addon',
            resourceId: id
        });

        return result.data;
    }
});

// ---------------------------------------------------------------------------
// Lifecycle endpoints — toggle, soft-delete, restore, hard-delete
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/admin/billing/addons/:id
 * Toggle the active flag of an add-on.
 */
export const adminToggleAddonActiveRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Toggle add-on active state (admin)',
    description:
        'Toggles the isActive flag of an add-on. Provide { "active": true|false } in the body.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    requestBody: z.object({
        active: z.boolean({ message: 'active must be a boolean' })
    }),
    responseSchema: AddonResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;
        const active = (body as { active: boolean }).active;

        apiLogger.info(
            { addonId: id, active, actorId: actor.id },
            'Admin toggling add-on active state'
        );

        const result = await catalogService.toggleActive(id, active, { actorId: actor.id });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to toggle add-on active state'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_addon',
            resourceId: id
        });

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/billing/addons/:id
 * Soft-delete an add-on. The row is retained; getById will return NOT_FOUND.
 */
export const adminSoftDeleteAddonRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete add-on definition (admin)',
    description:
        'Soft-deletes an add-on (sets deletedAt). The row is retained for referential integrity. Can be restored.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    responseSchema: z.null(),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ addonId: id, actorId: actor.id }, 'Admin soft-deleting add-on definition');

        const result = await catalogService.softDelete(id, { actorId: actor.id });

        if (!result.success) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to delete add-on'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'billing_addon',
            resourceId: id
        });

        return null;
    }
});

/**
 * POST /api/v1/admin/billing/addons/:id/restore
 * Restore a soft-deleted add-on: clears deletedAt and sets active = true.
 *
 * Returns 422 if the add-on is not currently soft-deleted (VALIDATION_ERROR guard).
 * Returns 404 if the add-on does not exist at all.
 */
export const adminRestoreAddonRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore soft-deleted add-on definition (admin)',
    description:
        'Restores a previously soft-deleted add-on by clearing deletedAt and re-enabling it (active = true). Returns 422 if the add-on is not currently soft-deleted.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    responseSchema: AddonResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info(
            { addonId: id, actorId: actor.id },
            'Admin restoring soft-deleted add-on definition'
        );

        const result = await catalogService.restore(id, { actorId: actor.id });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to restore add-on'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_addon',
            resourceId: id
        });

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/billing/addons/:id/hard
 * Permanently delete an add-on. Blocked if any purchase references it (conflict).
 * Maps the ALREADY_EXISTS error from the service to 409 Conflict.
 */
export const adminHardDeleteAddonRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard-delete add-on definition (admin)',
    description:
        'Permanently removes an add-on definition. Blocked with 409 if any addon purchase references this add-on.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Add-on ID must be a valid UUID')
    },
    responseSchema: z.null(),
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ addonId: id, actorId: actor.id }, 'Admin hard-deleting add-on definition');

        const result = await catalogService.hardDelete(id, { actorId: actor.id });

        if (!result.success) {
            // ALREADY_EXISTS from service = addon has purchase references → 409
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to hard-delete add-on'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'billing_addon',
            resourceId: id
        });

        return null;
    }
});

// ---------------------------------------------------------------------------
// Router composition
// ---------------------------------------------------------------------------

/**
 * Admin add-ons router.
 * Mounted under /api/v1/admin/billing/addons by admin/index.ts.
 */
export const adminAddonsRouter = createRouter();

// Read
adminAddonsRouter.route('/', adminListAddonsRoute);
adminAddonsRouter.route('/', adminGetAddonByIdRoute);

// Write
adminAddonsRouter.route('/', adminCreateAddonRoute);
adminAddonsRouter.route('/', adminUpdateAddonRoute);

// Lifecycle
adminAddonsRouter.route('/', adminToggleAddonActiveRoute);
adminAddonsRouter.route('/', adminSoftDeleteAddonRoute);
adminAddonsRouter.route('/', adminRestoreAddonRoute);
adminAddonsRouter.route('/', adminHardDeleteAddonRoute);
