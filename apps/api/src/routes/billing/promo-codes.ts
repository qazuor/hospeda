/**
 * Promo Code Routes
 *
 * REST API routes for promo code management.
 * Provides endpoints for:
 * - CRUD operations (admin only)
 * - Validation (authenticated)
 * - Application to checkout (authenticated, via promo-codes.apply.ts)
 *
 * Route tiers:
 * - Admin: GET/POST/PUT/DELETE /api/v1/admin/billing/promo-codes
 * - Protected: POST /api/v1/protected/billing/promo-codes/validate
 * - Protected: POST /api/v1/protected/billing/promo-codes/apply (promo-codes.apply.ts)
 *
 * @module routes/billing/promo-codes
 */

import {
    CreatePromoCodeSchema,
    ListPromoCodesQuerySchema,
    PermissionEnum,
    PromoCodeResponseSchema,
    type PromoEffect,
    UpdatePromoCodeSchema,
    ValidatePromoCodeSchema,
    ValidationResultSchema
} from '@repo/schemas';
import { PromoCodeService } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger';
import {
    createAdminListRoute,
    createAdminRoute,
    createProtectedRoute
} from '../../utils/route-factory';
import { applyPromoCodeRoute } from './promo-codes.apply.js';

/**
 * List all promo codes (admin only)
 *
 * GET /api/v1/admin/billing/promo-codes
 */
export const listPromoCodesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List promo codes',
    description: 'Returns a paginated list of all promo codes. Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_READ],
    requestQuery: ListPromoCodesQuerySchema.shape,
    responseSchema: PromoCodeResponseSchema,
    handler: async (_c, _params, _body, query) => {
        const service = new PromoCodeService();

        apiLogger.debug('Listing promo codes');

        const result = await service.list({
            active: query?.active as boolean | undefined,
            expired: query?.expired as boolean | undefined,
            codeSearch: query?.codeSearch as string | undefined,
            page: (query?.page as number | undefined) ?? 1,
            pageSize: (query?.pageSize as number | undefined) ?? 20
        });

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        return {
            items: result.data.items,
            pagination: result.data.pagination
        };
    }
});

/**
 * Create promo code (admin only)
 *
 * POST /api/v1/admin/billing/promo-codes
 *
 * Accepts the typed `effect` discriminated union (SPEC-262 T-004/T-005).
 * The Zod schema enforces effect-kind invariants (AC-1.2, AC-1.3, AC-5.4):
 * - discount: percentage value ≤ 100, durationCycles > 0 when not null
 * - trial_extension: extraDays > 0
 * - comp: no additional params
 *
 * Permission guard: BILLING_PROMO_CODE_MANAGE (AC-6.1).
 */
export const createPromoCodeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create promo code',
    description:
        'Creates a new promo code with a typed effect (discount / trial_extension / comp). Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_MANAGE],
    requestBody: CreatePromoCodeSchema,
    responseSchema: PromoCodeResponseSchema,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const service = new PromoCodeService();

        apiLogger.info('Creating promo code');

        // SPEC-262 T-008: `body.effect` (discriminated union from CreatePromoCodeSchema)
        // is validated by Zod before reaching this handler. Invalid effect params
        // (durationCycles=0, negative extraDays, percentage > 100) are rejected at
        // the schema layer with a 422 response (AC-1.2, AC-1.3, AC-5.4).
        const result = await service.create(
            {
                code: body.code as string,
                // Typed effect (SPEC-262 T-005 primary path).
                // Cast: the route-factory body is typed `Record<string, unknown>` at
                // the call site; the Zod schema has already validated the shape so
                // this cast is safe.
                effect: body.effect as PromoEffect | undefined,
                description: body.description as string | undefined,
                expiryDate: body.expiryDate as Date | undefined,
                validFrom: body.validFrom as Date | undefined,
                maxUses: body.maxUses as number | undefined,
                maxUsesPerUser: body.maxUsesPerUser as number | undefined,
                planRestrictions: body.planRestrictions as string[] | undefined,
                firstPurchaseOnly: (body.firstPurchaseOnly as boolean | undefined) ?? false,
                isStackable: (body.isStackable as boolean | undefined) ?? false,
                minAmount: body.minAmount as number | undefined,
                isActive: (body.isActive as boolean | undefined) ?? true
            },
            { livemode: env.NODE_ENV === 'production' }
        );

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'create',
            resourceType: 'promo_code',
            resourceId: result.data.id as string
        });

        return result.data;
    }
});

/**
 * Get promo code by ID (admin only)
 *
 * GET /api/v1/admin/billing/promo-codes/:id
 */
export const getPromoCodeRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get promo code',
    description: 'Returns a promo code by ID. Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_READ],
    requestParams: {
        id: z.string().uuid('Invalid promo code ID')
    },
    responseSchema: PromoCodeResponseSchema,
    handler: async (_c, params) => {
        const service = new PromoCodeService();

        apiLogger.debug('Getting promo code');

        const result = await service.getById(params.id as string);

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 404;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Promo code not found'
            });
        }

        return result.data;
    }
});

/**
 * Update promo code (admin only)
 *
 * PUT /api/v1/admin/billing/promo-codes/:id
 *
 * Only mutable fields are accepted. The `effect` and its parameters are
 * immutable once created (UpdatePromoCodeSchema uses `.strict()` to reject
 * any attempt to change them).
 *
 * Permission guard: BILLING_PROMO_CODE_MANAGE (AC-6.1).
 */
export const updatePromoCodeRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update promo code',
    description:
        'Updates mutable fields of a promo code (description, expiry, maxUses, isActive). Effect params are immutable. Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_MANAGE],
    requestParams: {
        id: z.string().uuid('Invalid promo code ID')
    },
    requestBody: UpdatePromoCodeSchema,
    responseSchema: PromoCodeResponseSchema,
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const service = new PromoCodeService();

        apiLogger.info('Updating promo code');

        const result = await service.update(params.id as string, {
            description: body.description as string | undefined,
            expiryDate: body.expiryDate as Date | undefined,
            maxUses: body.maxUses as number | undefined,
            isActive: body.isActive as boolean | undefined
        });

        if (!result.success || !result.data) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'update',
            resourceType: 'promo_code',
            resourceId: params.id as string
        });

        return result.data;
    }
});

/**
 * Delete promo code (admin only)
 *
 * DELETE /api/v1/admin/billing/promo-codes/:id
 *
 * Soft-deletes (sets active = false). Permission guard: BILLING_PROMO_CODE_MANAGE (AC-6.1).
 */
export const deletePromoCodeRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete promo code',
    description: 'Soft deletes a promo code. Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_MANAGE],
    requestParams: {
        id: z.string().uuid('Invalid promo code ID')
    },
    responseSchema: z.null(),
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const service = new PromoCodeService();

        apiLogger.info('Deleting promo code');

        const result = await service.delete(params.id as string);

        if (!result.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        auditLog({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: actor.id,
            action: 'delete',
            resourceType: 'promo_code',
            resourceId: params.id as string
        });

        return null;
    }
});

/**
 * Validate promo code (authenticated)
 *
 * POST /api/v1/protected/billing/promo-codes/validate
 *
 * Rate limited: 5 requests per minute per IP to prevent brute-force code enumeration.
 */
export const validatePromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/validate',
    summary: 'Validate promo code',
    description: 'Validates a promo code for a specific context. Requires authentication.',
    tags: ['Billing - Promo Codes'],
    requestBody: ValidatePromoCodeSchema,
    responseSchema: ValidationResultSchema,
    options: {
        customRateLimit: { requests: 5, windowMs: 60_000 }
    },
    handler: async (c, _params, body) => {
        const service = new PromoCodeService();
        const actor = getActorFromContext(c);

        apiLogger.debug('Validating promo code');

        // Ensure user is validating for themselves (unless they have admin access)
        if (
            !actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) &&
            body.userId !== actor.id
        ) {
            throw new HTTPException(403, { message: 'Forbidden: admin access required' });
        }

        const result = await service.validate(body.code as string, {
            planId: body.planId as string | undefined,
            userId: body.userId as string,
            amount: body.amount as number | undefined
        });

        // Strip internal fields: only expose what the client needs.
        // SPEC-262 T-012: include effectPreview when present (valid codes only).
        return {
            valid: result.valid,
            ...(result.errorCode !== undefined && { errorCode: result.errorCode }),
            ...(result.errorMessage !== undefined && { errorMessage: result.errorMessage }),
            ...(result.discountAmount !== undefined && { discountAmount: result.discountAmount }),
            ...(result.effectPreview !== undefined && { effectPreview: result.effectPreview })
        };
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

/**
 * Admin promo codes router
 *
 * Bundles the 5 admin-only verbs (list/create/get/update/delete). Mounted by
 * `apps/api/src/routes/billing/admin/index.ts` under `/api/v1/admin/billing/
 * promo-codes` so the admin app calls the proper `/admin/*` tier per
 * project convention.
 */
export const adminPromoCodesRouter = createRouter();

adminPromoCodesRouter.route('/', listPromoCodesRoute);
adminPromoCodesRouter.route('/', createPromoCodeRoute);
adminPromoCodesRouter.route('/', getPromoCodeRoute);
adminPromoCodesRouter.route('/', updatePromoCodeRoute);
adminPromoCodesRouter.route('/', deletePromoCodeRoute);

/**
 * User-facing promo codes router
 *
 * Bundles the 2 user-self verbs (validate/apply). Mounted by
 * `apps/api/src/routes/billing/index.ts` under
 * `/api/v1/protected/billing/promo-codes`.
 *
 * The apply route is defined in `promo-codes.apply.ts` to keep this file
 * within the 500-line limit.
 */
export const userPromoCodesRouter = createRouter();

userPromoCodesRouter.route('/', validatePromoCodeRoute);
userPromoCodesRouter.route('/', applyPromoCodeRoute);
