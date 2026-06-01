/**
 * Admin Plan Management Routes
 *
 * Full CRUD + lifecycle endpoints for billing plan management.
 * Plans are read from and written to the database via PlanService.
 *
 * Routes:
 * - GET    /api/v1/admin/billing/plans         - List plans (paginated + filtered)
 * - GET    /api/v1/admin/billing/plans/:id     - Get plan by UUID
 * - POST   /api/v1/admin/billing/plans         - Create new plan
 * - PUT    /api/v1/admin/billing/plans/:id     - Update plan fields (slug immutable)
 * - PATCH  /api/v1/admin/billing/plans/:id     - Toggle plan active state
 * - DELETE /api/v1/admin/billing/plans/:id     - Soft-delete plan
 * - POST   /api/v1/admin/billing/plans/:id/restore - Restore soft-deleted plan
 * - DELETE /api/v1/admin/billing/plans/:id/hard    - Hard-delete (blocked if referenced)
 *
 * Permissions (D2):
 * - Read: PermissionEnum.BILLING_READ_ALL
 * - Write/lifecycle: PermissionEnum.BILLING_MANAGE
 *
 * @module routes/billing/admin/plans
 */

import {
    AdminBillingPlanResponseSchema,
    BillingPlanResponseSchema,
    BillingPlanSearchSchema,
    CreateBillingPlanSchema,
    PermissionEnum,
    ServiceErrorCode,
    UpdateBillingPlanSchema
} from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { PlanService } from '../../../services/plan.service';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';

/** Singleton plan service instance */
const planService = new PlanService();

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
// T-008: Read endpoints — list + getById
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/billing/plans
 * List plans with pagination and optional filters. DB-backed via PlanService.
 */
export const adminListPlansRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List billing plans (admin)',
    description:
        'Returns paginated billing plans from the database. Supports filtering by category, active status, and free-text search. Unlike the public endpoint this returns all plans including inactive ones.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: BillingPlanSearchSchema.shape,
    responseSchema: AdminBillingPlanResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const filters = query as {
            category?: 'owner' | 'complex' | 'tourist';
            active?: boolean;
            search?: string;
            includeDeleted?: boolean;
            page?: number;
            pageSize?: number;
        };

        apiLogger.debug({ filters }, 'Admin listing billing plans from DB');

        const result = await planService.list({
            category: filters.category,
            active: filters.active,
            search: filters.search,
            includeDeleted: filters.includeDeleted,
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? 20
        });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to list plans'
            });
        }

        return {
            items: result.data.items,
            pagination: result.data.pagination
        };
    }
});

/**
 * GET /api/v1/admin/billing/plans/:id
 * Get a single billing plan by UUID.
 */
export const adminGetPlanRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get billing plan by ID (admin)',
    description:
        'Returns a single billing plan by its UUID. Includes id, timestamps, and all metadata.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    responseSchema: BillingPlanResponseSchema,
    handler: async (_c, params) => {
        const id = params.id as string;
        apiLogger.debug({ planId: id }, 'Admin getting billing plan from DB');

        const result = await planService.getById(id);

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Plan not found'
            });
        }

        return result.data;
    }
});

// ---------------------------------------------------------------------------
// T-009: Write endpoints — create + update
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/plans
 * Create a new billing plan. Returns the created plan with id + timestamps.
 */
export const adminCreatePlanRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create billing plan (admin)',
    description:
        'Creates a new billing plan with associated pricing rows. Slug is immutable after creation.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestBody: CreateBillingPlanSchema,
    responseSchema: BillingPlanResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const input = body as {
            slug: string;
            name: string;
            description: string;
            category: 'owner' | 'complex' | 'tourist';
            monthlyPriceArs: number;
            annualPriceArs: number | null;
            monthlyPriceUsdRef: number;
            hasTrial: boolean;
            trialDays: number;
            isDefault: boolean;
            sortOrder: number;
            entitlements: string[];
            limits: Record<string, number>;
            isActive: boolean;
        };

        apiLogger.info({ slug: input.slug, actorId: actor.id }, 'Admin creating billing plan');

        const result = await planService.create(
            {
                slug: input.slug,
                name: input.name,
                description: input.description,
                category: input.category,
                monthlyPriceArs: input.monthlyPriceArs,
                annualPriceArs: input.annualPriceArs,
                monthlyPriceUsdRef: input.monthlyPriceUsdRef,
                hasTrial: input.hasTrial,
                trialDays: input.trialDays,
                isDefault: input.isDefault,
                sortOrder: input.sortOrder,
                entitlements: input.entitlements,
                limits: input.limits,
                isActive: input.isActive
            },
            { actorId: actor.id }
        );

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to create plan'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'billing_plan',
            resourceId: result.data.id
        });

        return result.data;
    }
});

/**
 * PUT /api/v1/admin/billing/plans/:id
 * Update mutable fields of a billing plan. Slug is immutable (rejected by service).
 */
export const adminUpdatePlanRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update billing plan (admin)',
    description:
        'Updates mutable fields of a billing plan. Slug cannot be changed after creation (D1).',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    requestBody: UpdateBillingPlanSchema,
    responseSchema: BillingPlanResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ planId: id, actorId: actor.id }, 'Admin updating billing plan');

        const result = await planService.update(
            id,
            body as {
                name?: string;
                description?: string;
                category?: 'owner' | 'complex' | 'tourist';
                monthlyPriceArs?: number;
                annualPriceArs?: number | null;
                monthlyPriceUsdRef?: number;
                hasTrial?: boolean;
                trialDays?: number;
                isDefault?: boolean;
                sortOrder?: number;
                entitlements?: string[];
                limits?: Record<string, number>;
                isActive?: boolean;
            },
            { actorId: actor.id }
        );

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to update plan'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_plan',
            resourceId: id
        });

        return result.data;
    }
});

// ---------------------------------------------------------------------------
// T-010: Lifecycle endpoints — toggle, soft-delete, restore, hard-delete
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/admin/billing/plans/:id
 * Toggle the active flag of a billing plan.
 */
export const adminTogglePlanActiveRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Toggle plan active state (admin)',
    description:
        'Toggles the isActive flag of a billing plan. Provide { "active": true|false } in the body.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    requestBody: z.object({
        active: z.boolean({ message: 'active must be a boolean' })
    }),
    responseSchema: BillingPlanResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;
        const active = (body as { active: boolean }).active;

        apiLogger.info(
            { planId: id, active, actorId: actor.id },
            'Admin toggling plan active state'
        );

        const result = await planService.toggleActive(id, active, { actorId: actor.id });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to toggle plan active state'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_plan',
            resourceId: id
        });

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/billing/plans/:id
 * Soft-delete a billing plan. The row is retained; getById will return NOT_FOUND.
 */
export const adminSoftDeletePlanRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete billing plan (admin)',
    description:
        'Soft-deletes a billing plan (sets deletedAt). The row is retained for referential integrity. Can be restored.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    responseSchema: z.null(),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ planId: id, actorId: actor.id }, 'Admin soft-deleting billing plan');

        const result = await planService.softDelete(id, { actorId: actor.id });

        if (!result.success) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to delete plan'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'billing_plan',
            resourceId: id
        });

        return null;
    }
});

/**
 * POST /api/v1/admin/billing/plans/:id/restore
 * Restore a soft-deleted billing plan: clears deletedAt and sets active = true.
 *
 * Returns 422 if the plan is not currently soft-deleted (VALIDATION_ERROR guard).
 * Returns 404 if the plan does not exist at all.
 */
export const adminRestorePlanRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore soft-deleted billing plan (admin)',
    description:
        'Restores a previously soft-deleted billing plan by clearing deletedAt and re-enabling it (active = true). Returns 422 if the plan is not currently soft-deleted.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    responseSchema: BillingPlanResponseSchema,
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info(
            { planId: id, actorId: actor.id },
            'Admin restoring soft-deleted billing plan'
        );

        // Delegates to restorePlan which clears deletedAt + sets active=true atomically.
        const result = await planService.restore(id, { actorId: actor.id });

        if (!result.success || !result.data) {
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to restore plan'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'billing_plan',
            resourceId: id
        });

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/billing/plans/:id/hard
 * Permanently delete a billing plan. Blocked if any subscription references it (D4).
 * Maps the ALREADY_EXISTS error from the service to 409 Conflict.
 */
export const adminHardDeletePlanRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard-delete billing plan (admin)',
    description:
        'Permanently removes a billing plan and its prices. Blocked with 409 if any subscription references this plan (D4).',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        id: z.string().uuid('Plan ID must be a valid UUID')
    },
    responseSchema: z.null(),
    options: {
        customRateLimit: { requests: 10, windowMs: 60_000 }
    },
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        apiLogger.info({ planId: id, actorId: actor.id }, 'Admin hard-deleting billing plan');

        const result = await planService.hardDelete(id, { actorId: actor.id });

        if (!result.success) {
            // ALREADY_EXISTS from service = plan has active subscriptions → 409
            const status = mapServiceErrorToStatus(result.error?.code);
            throw new HTTPException(status, {
                message: result.error?.message ?? 'Failed to hard-delete plan'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'billing_plan',
            resourceId: id
        });

        return null;
    }
});

// ---------------------------------------------------------------------------
// Router composition
// ---------------------------------------------------------------------------

/**
 * Admin plans router.
 * Mounted under /api/v1/admin/billing/plans by admin/index.ts.
 */
export const adminPlansRouter = createRouter();

// T-008: Read
adminPlansRouter.route('/', adminListPlansRoute);
adminPlansRouter.route('/', adminGetPlanRoute);

// T-009: Write
adminPlansRouter.route('/', adminCreatePlanRoute);
adminPlansRouter.route('/', adminUpdatePlanRoute);

// T-010: Lifecycle
adminPlansRouter.route('/', adminTogglePlanActiveRoute);
adminPlansRouter.route('/', adminSoftDeletePlanRoute);
adminPlansRouter.route('/', adminRestorePlanRoute);
adminPlansRouter.route('/', adminHardDeletePlanRoute);
