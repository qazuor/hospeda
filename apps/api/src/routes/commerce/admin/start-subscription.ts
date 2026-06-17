/**
 * Admin commerce start-subscription endpoint (SPEC-239 T-048)
 *
 * Provisions a monthly commerce-listing subscription on behalf of a listing's
 * owner. The admin selects a commerce listing (`entityType` + `entityId`); the
 * route resolves the listing's owner, ensures a billing customer exists, and
 * delegates to {@link initiateCommerceMonthlySubscription} which:
 *   - creates the MP preapproval subscription,
 *   - stamps `billing_subscriptions.product_domain = 'commerce'` (D3),
 *   - upserts the `commerce_listing_subscriptions` link row (D4).
 *
 * Gated on `PermissionEnum.COMMERCE_EDIT_ALL` (D2, consistent with the
 * gastronomy assign-owner route — no new permission is introduced).
 *
 * Route: POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription
 *
 * @module routes/commerce/admin/start-subscription
 */

import { PermissionEnum, StartPaidSubscriptionResponseSchema } from '@repo/schemas';
import type { StartPaidSubscriptionResponse } from '@repo/schemas';
import { GastronomyService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    SubscriptionCheckoutError,
    initiateCommerceMonthlySubscription
} from '../../../services/subscription-checkout.service';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Supported commerce entity types. Today only gastronomy is wired; the enum is
 * the single sanctioned set so an unknown entityType is rejected at the schema
 * boundary (400) rather than reaching the service.
 */
const CommerceEntityTypeSchema = z.enum(['gastronomy']);
type CommerceEntityType = z.infer<typeof CommerceEntityTypeSchema>;

/** Path params for the start-subscription endpoint. */
const StartSubscriptionParamsSchema = {
    entityType: CommerceEntityTypeSchema,
    entityId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
};

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Webhook destination for the MP preapproval. Mirrors the accommodation flow.
 */
function buildNotificationUrl(): string {
    return `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`;
}

/**
 * MercadoPago `back_url` for the commerce preapproval. The admin provisions on
 * the owner's behalf, so the return URL points at the admin commerce surface.
 * MP requires a non-empty back_url; the exact landing page is not load-bearing
 * (the admin re-checks status server-side).
 */
function buildPaymentMethodReturnUrl(): string {
    return `${env.HOSPEDA_ADMIN_URL}/commerce/listings`;
}

/**
 * Resolve the owner user id of a commerce listing.
 *
 * Switches on `entityType`. Throws a 404 HTTPException when the listing is not
 * found or has no owner assigned (a listing must have an owner before a
 * subscription can be provisioned — assign one via the assign-owner route first).
 */
async function resolveListingOwnerId(
    ctx: Context,
    entityType: CommerceEntityType,
    entityId: string
): Promise<string> {
    const actor = getActorFromContext(ctx);

    if (entityType === 'gastronomy') {
        const result = await gastronomyService.getById(actor, entityId);
        if (result.error) {
            throw new HTTPException(404, {
                message: `Commerce listing not found: ${entityType}/${entityId}`
            });
        }
        const ownerId = (result.data as { ownerId?: string } | null)?.ownerId;
        if (!ownerId) {
            throw new HTTPException(422, {
                message:
                    'Commerce listing has no owner assigned. Assign an owner before starting a subscription.'
            });
        }
        return ownerId;
    }

    // Defensive: the schema enum already rejects unknown types with a 400.
    throw new HTTPException(400, { message: `Unsupported commerce entityType: ${entityType}` });
}

/**
 * Maps a {@link SubscriptionCheckoutError} to an HTTP exception. Kept local so
 * the service stays framework-agnostic.
 */
function mapCheckoutErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MONTHLY_PRICE':
        case 'CUSTOMER_NOT_FOUND':
            return new HTTPException(404, { message: err.message });
        case 'MISSING_INIT_POINT':
            return new HTTPException(500, { message: err.message });
        default:
            return new HTTPException(500, { message: err.message });
    }
}

/**
 * POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription
 *
 * Permission: COMMERCE_EDIT_ALL (D2).
 */
export const adminStartCommerceSubscriptionRoute = createAdminRoute({
    method: 'post',
    path: '/listings/:entityType/:entityId/start-subscription',
    summary: 'Start a commerce-listing subscription (admin)',
    description:
        'Provisions a monthly MercadoPago subscription for a commerce listing on behalf of its owner. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Commerce', 'Billing'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: StartSubscriptionParamsSchema,
    responseSchema: StartPaidSubscriptionResponseSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>
    ): Promise<StartPaidSubscriptionResponse> => {
        const entityType = params.entityType as CommerceEntityType;
        const entityId = params.entityId as string;

        // Resolve the commerce plan slug from env (D1).
        const planSlug = env.HOSPEDA_COMMERCE_PLAN_ID;
        if (!planSlug) {
            throw new HTTPException(503, {
                message:
                    'Commerce subscriptions are not configured (HOSPEDA_COMMERCE_PLAN_ID unset)'
            });
        }

        const billing = getQZPayBilling();
        if (!billing) {
            throw new HTTPException(503, { message: 'Billing service is not available' });
        }

        // Resolve the listing's owner, then its billing customer.
        const ownerId = await resolveListingOwnerId(ctx, entityType, entityId);

        const customer = await billing.customers.getByExternalId(ownerId);
        if (!customer) {
            throw new HTTPException(422, {
                message:
                    'The listing owner has no billing customer yet. The owner must sign in once so the billing customer is provisioned before a subscription can start.'
            });
        }

        try {
            const result = await initiateCommerceMonthlySubscription({
                customerId: customer.id,
                planSlug,
                entityType,
                entityId,
                billing,
                urls: {
                    paymentMethodReturnUrl: buildPaymentMethodReturnUrl(),
                    notificationUrl: buildNotificationUrl()
                }
            });

            apiLogger.info(
                {
                    localSubscriptionId: result.localSubscriptionId,
                    customerId: customer.id,
                    entityType,
                    entityId,
                    planSlug
                },
                'Commerce subscription initiated, awaiting provider authorization'
            );

            return result;
        } catch (error) {
            if (error instanceof SubscriptionCheckoutError) {
                throw mapCheckoutErrorToHttp(error);
            }
            if (error instanceof HTTPException) {
                throw error;
            }
            apiLogger.error(
                {
                    entityType,
                    entityId,
                    planSlug,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Failed to start commerce subscription'
            );
            throw new HTTPException(500, {
                message: 'Failed to start commerce subscription. Please try again.'
            });
        }
    }
});
