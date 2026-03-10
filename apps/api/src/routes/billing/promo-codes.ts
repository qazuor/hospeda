/**
 * Promo Code Routes
 *
 * REST API routes for promo code management.
 * Provides endpoints for:
 * - CRUD operations (admin only)
 * - Validation (authenticated)
 * - Application to checkout (authenticated)
 *
 * All routes are mounted under /api/v1/protected/billing/promo-codes
 *
 * @module routes/billing/promo-codes
 */

import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import {
    ApplyPromoCodeSchema,
    CreatePromoCodeSchema,
    ListPromoCodesQuerySchema,
    PromoCodeResponseSchema,
    UpdatePromoCodeSchema,
    ValidatePromoCodeSchema,
    ValidationResultSchema
} from '../../schemas/promo-code.schema';
import { PromoCodeService } from '../../services/promo-code.service';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import {
    createAdminListRoute,
    createAdminRoute,
    createProtectedRoute
} from '../../utils/route-factory';

/**
 * List all promo codes (admin only)
 *
 * GET /api/v1/protected/billing/promo-codes
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
 * POST /api/v1/protected/billing/promo-codes
 */
export const createPromoCodeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create promo code',
    description: 'Creates a new promo code. Admin only.',
    tags: ['Billing - Promo Codes'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_MANAGE],
    requestBody: CreatePromoCodeSchema,
    responseSchema: PromoCodeResponseSchema,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const service = new PromoCodeService();

        apiLogger.info('Creating promo code');

        const result = await service.create({
            code: body.code as string,
            discountType: body.discountType as 'percentage' | 'fixed',
            discountValue: body.discountValue as number,
            description: body.description as string | undefined,
            expiryDate: body.expiryDate as Date | undefined,
            maxUses: body.maxUses as number | undefined,
            planRestrictions: body.planRestrictions as string[] | undefined,
            firstPurchaseOnly: (body.firstPurchaseOnly as boolean | undefined) ?? false,
            minAmount: body.minAmount as number | undefined,
            isActive: (body.isActive as boolean | undefined) ?? true
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
 * GET /api/v1/protected/billing/promo-codes/:id
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

        // Check for error or missing data
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
 * PUT /api/v1/protected/billing/promo-codes/:id
 */
export const updatePromoCodeRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update promo code',
    description: 'Updates a promo code. Admin only.',
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
 * DELETE /api/v1/protected/billing/promo-codes/:id
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
 */
export const validatePromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/validate',
    summary: 'Validate promo code',
    description: 'Validates a promo code for a specific context. Requires authentication.',
    tags: ['Billing - Promo Codes'],
    requestBody: ValidatePromoCodeSchema,
    responseSchema: ValidationResultSchema,
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

        // Strip internal fields: only expose what the client needs
        return {
            valid: result.valid,
            ...(result.errorCode !== undefined && { errorCode: result.errorCode }),
            ...(result.errorMessage !== undefined && { errorMessage: result.errorMessage }),
            ...(result.discountAmount !== undefined && { discountAmount: result.discountAmount })
        };
    }
});

/**
 * Apply promo code to checkout (authenticated)
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 */
export const applyPromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/apply',
    summary: 'Apply promo code',
    description: 'Applies a promo code to a checkout session. Requires authentication.',
    tags: ['Billing - Promo Codes'],
    requestBody: ApplyPromoCodeSchema,
    responseSchema: z.object({
        id: z.string(),
        promoCode: z.string().nullable(),
        // Add other checkout fields as needed
        amount: z.number(),
        discountAmount: z.number()
    }),
    handler: async (c, _params, body) => {
        const service = new PromoCodeService();
        const actor = getActorFromContext(c);

        apiLogger.info('Applying promo code');

        // Get billing customer ID from context
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(422, {
                message: 'Billing customer not found. Please contact support.'
            });
        }

        // Verify ownership: ensure user is applying promo code to their own billing account
        if (
            !actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) &&
            body.customerId !== billingCustomerId
        ) {
            throw new HTTPException(403, { message: 'Forbidden: admin access required' });
        }

        const result = await service.apply(
            body.code as string,
            body.customerId as string,
            body.amount as number | undefined
        );

        if (result.success === false) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500, {
                message: result.error?.message ?? 'Unknown error applying promo code'
            });
        }

        return {
            id: body.customerId as string,
            promoCode: body.code as string,
            amount: result.data.finalAmount,
            discountAmount: result.data.discountAmount
        };
    }
});

/**
 * Promo codes router
 *
 * Combines all promo code routes
 */
export const promoCodesRouter = createRouter();

// Mount all routes
promoCodesRouter.route('/', listPromoCodesRoute);
promoCodesRouter.route('/', createPromoCodeRoute);
promoCodesRouter.route('/', getPromoCodeRoute);
promoCodesRouter.route('/', updatePromoCodeRoute);
promoCodesRouter.route('/', deletePromoCodeRoute);
promoCodesRouter.route('/', validatePromoCodeRoute);
promoCodesRouter.route('/', applyPromoCodeRoute);
