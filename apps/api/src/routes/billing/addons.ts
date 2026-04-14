/**
 * Add-on Routes
 *
 * REST API routes for add-on management.
 * Provides endpoints for:
 * - Listing available add-ons (authenticated)
 * - Getting add-on details (authenticated)
 * - Purchasing add-ons (authenticated)
 * - Listing user's active add-ons (authenticated)
 * - Canceling recurring add-ons (authenticated)
 *
 * All routes are mounted under /api/v1/protected/billing/addons
 *
 * @module routes/billing/addons
 */

import {
    AddonResponseSchema,
    CancelAddonSchema,
    ListAddonsQuerySchema,
    PurchaseAddonResponseSchema,
    PurchaseAddonSchema,
    UserAddonResponseSchema
} from '@repo/schemas';
import { withServiceTransaction } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { clearEntitlementCache } from '../../middlewares/entitlement';
import { AddonService } from '../../services/addon.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

/**
 * List available add-ons (authenticated)
 *
 * GET /api/v1/protected/billing/addons
 */
export const listAddonsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List available add-ons',
    description: 'Returns a list of available add-ons for purchase. Requires authentication.',
    tags: ['Billing - Add-ons'],
    requestQuery: ListAddonsQuerySchema.shape,
    responseSchema: z.array(AddonResponseSchema),
    handler: async (_c, _params, _body, query) => {
        const billing = getQZPayBilling();
        const service = new AddonService(billing);

        apiLogger.debug(
            {
                filters: query
            },
            'Listing available add-ons'
        );

        const result = await service.listAvailable({
            billingType: query?.billingType as 'one_time' | 'recurring' | undefined,
            targetCategory: query?.targetCategory as 'owner' | 'complex' | undefined,
            active: query?.active as boolean | undefined
        });

        if (!result.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                SERVICE_UNAVAILABLE: 503,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500 | 503, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        if (!result.data) {
            throw new HTTPException(500, {
                message: 'Failed to list add-ons'
            });
        }

        return result.data;
    }
});

/**
 * Get add-on by slug (authenticated)
 *
 * GET /api/v1/protected/billing/addons/:slug
 */
export const getAddonRoute = createProtectedRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Get add-on details',
    description: 'Returns details for a specific add-on. Requires authentication.',
    tags: ['Billing - Add-ons'],
    requestParams: {
        slug: z.string().min(1, 'Add-on slug is required')
    },
    responseSchema: AddonResponseSchema,
    handler: async (_c, params) => {
        const billing = getQZPayBilling();
        const service = new AddonService(billing);

        apiLogger.debug(
            {
                slug: params.slug
            },
            'Getting add-on details'
        );

        const result = await service.getById(params.slug as string);

        if (!result.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                SERVICE_UNAVAILABLE: 503,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500 | 503, {
                message: result.error?.message ?? 'Failed to get add-on'
            });
        }

        if (!result.data) {
            throw new HTTPException(404, {
                message: 'Add-on not found'
            });
        }

        return result.data;
    }
});

/**
 * Purchase add-on (authenticated)
 *
 * POST /api/v1/protected/billing/addons/:slug/purchase
 */
export const purchaseAddonRoute = createProtectedRoute({
    method: 'post',
    path: '/{slug}/purchase',
    summary: 'Purchase add-on',
    description:
        'Initiates add-on purchase and returns checkout URL. Requires authentication and active subscription.',
    tags: ['Billing - Add-ons'],
    requestParams: {
        slug: z.string().min(1, 'Add-on slug is required')
    },
    requestBody: PurchaseAddonSchema,
    responseSchema: PurchaseAddonResponseSchema,
    handler: async (c, params, body) => {
        const billing = getQZPayBilling();
        const service = new AddonService(billing);
        const actor = getActorFromContext(c);

        // Get billing customer ID from context
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(422, {
                message: 'Billing customer not found. Please contact support.'
            });
        }

        apiLogger.info(
            {
                userId: actor.id,
                customerId: billingCustomerId,
                addonSlug: params.slug,
                promoCode: body.promoCode
            },
            'Purchasing add-on'
        );

        const result = await service.purchase({
            customerId: billingCustomerId,
            addonSlug: params.slug as string,
            promoCode: body.promoCode as string | undefined,
            userId: actor.id
        });

        if (!result.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                NO_SUBSCRIPTION: 422,
                NO_ACTIVE_SUBSCRIPTION: 422,
                ADDON_INACTIVE: 422,
                CUSTOMER_NOT_FOUND: 404,
                INVALID_PROMO_CODE: 422,
                ADDON_ALREADY_ACTIVE: 409,
                PAYMENT_NOT_CONFIGURED: 503,
                CHECKOUT_ERROR: 500,
                SERVICE_UNAVAILABLE: 503,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 409 | 422 | 500 | 503, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        if (!result.data) {
            throw new HTTPException(500, {
                message: 'Failed to create checkout session'
            });
        }

        return result.data;
    }
});

/**
 * Get user's active add-ons (authenticated)
 *
 * GET /api/v1/protected/billing/addons/my
 */
export const getUserAddonsRoute = createProtectedRoute({
    method: 'get',
    path: '/my',
    summary: "Get user's active add-ons",
    description: "Returns a list of the authenticated user's active add-ons.",
    tags: ['Billing - Add-ons'],
    responseSchema: z.array(UserAddonResponseSchema),
    handler: async (c) => {
        const billing = getQZPayBilling();
        const service = new AddonService(billing);
        const actor = getActorFromContext(c);

        apiLogger.debug(
            {
                userId: actor.id
            },
            "Getting user's active add-ons"
        );

        const result = await service.getUserAddons(actor.id);

        if (!result.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                SERVICE_UNAVAILABLE: 503,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 500 | 503, {
                message: result.error?.message ?? 'Unknown error'
            });
        }

        if (!result.data) {
            throw new HTTPException(500, {
                message: 'Failed to get user add-ons'
            });
        }

        return result.data;
    }
});

/**
 * Cancel recurring add-on (authenticated)
 *
 * POST /api/v1/protected/billing/addons/:id/cancel
 *
 * Ownership is verified in the handler before calling the service,
 * matching the defense-in-depth pattern used by other billing routes.
 */
export const cancelAddonRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/cancel',
    summary: 'Cancel recurring add-on',
    description:
        'Cancels a recurring add-on subscription. The add-on will remain active until the end of the current billing period.',
    tags: ['Billing - Add-ons'],
    requestParams: {
        id: z.string().uuid('Invalid add-on ID')
    },
    requestBody: CancelAddonSchema,
    responseSchema: z.null(),
    handler: async (c, params, body) => {
        const billing = getQZPayBilling();
        const service = new AddonService(billing);
        const actor = getActorFromContext(c);

        // Get billing customer ID from context
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(422, {
                message: 'Billing customer not found. Please contact support.'
            });
        }

        // TODO(GAP-038-48): The ownership check below (select by id + customerId) fetches the
        // purchase record, and service.cancelAddon() likely performs a second fetch of the same
        // row internally. Consider extending the service to accept a pre-fetched purchase to
        // eliminate the redundant DB round-trip. Low priority until profiling confirms it matters.

        // Wrap ownership check + cancel in a single transaction so the ownership
        // row cannot be modified between the SELECT and the cancel operation.
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
        const { and, eq, isNull } = await import('drizzle-orm');

        await withServiceTransaction(async (ctx) => {
            // Verify addon ownership using the transaction client
            // biome-ignore lint/style/noNonNullAssertion: tx is guaranteed by withServiceTransaction
            const [ownedAddon] = await ctx
                .tx!.select({ id: billingAddonPurchases.id })
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.id, params.id as string),
                        eq(billingAddonPurchases.customerId, billingCustomerId),
                        eq(billingAddonPurchases.status, 'active'),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                )
                .limit(1);

            if (!ownedAddon) {
                throw new HTTPException(404, {
                    message: 'Add-on not found or does not belong to your account.'
                });
            }

            apiLogger.info(
                {
                    userId: actor.id,
                    customerId: billingCustomerId,
                    addonId: params.id,
                    reason: body.reason
                },
                'Canceling add-on'
            );

            const result = await service.cancelAddon({
                customerId: billingCustomerId,
                purchaseId: ownedAddon.id,
                reason: body.reason as string | undefined,
                userId: actor.id
            });

            if (!result.success) {
                const statusMap: Record<string, number> = {
                    NOT_FOUND: 404,
                    VALIDATION_ERROR: 400,
                    PERMISSION_DENIED: 403,
                    NO_SUBSCRIPTION: 422,
                    NO_ACTIVE_SUBSCRIPTION: 422,
                    SERVICE_UNAVAILABLE: 503,
                    INTERNAL_ERROR: 500
                };
                const status = statusMap[result.error?.code ?? ''] ?? 500;
                throw new HTTPException(status as 400 | 403 | 404 | 422 | 500 | 503, {
                    message: result.error?.message ?? 'Unknown error'
                });
            }
        });

        // Clear entitlement cache so the cancellation is reflected immediately
        clearEntitlementCache(billingCustomerId);

        return null;
    }
});

/**
 * Add-ons router
 *
 * Combines all add-on routes
 */
export const addonsRouter = createRouter();

// Mount all routes (literal paths before parameterized to prevent matching conflicts)
addonsRouter.route('/', listAddonsRoute);
addonsRouter.route('/', getUserAddonsRoute);
addonsRouter.route('/', getAddonRoute);
addonsRouter.route('/', purchaseAddonRoute);
addonsRouter.route('/', cancelAddonRoute);
