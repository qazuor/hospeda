/**
 * Admin Subscription Trial Extension Route (SPEC-262 T-009)
 *
 * POST /api/v1/admin/billing/subscriptions/:subscriptionId/apply-trial-extension
 *
 * Applies a `trial_extension` promo code to an existing subscription's trial
 * period. The subscription must be in `trialing` status (AC-3.4). Annual
 * subscriptions in trial are accepted; those past trial are rejected (AC-3.5).
 *
 * Authorization:
 * - Requires `BILLING_PROMO_CODE_MANAGE` (AC-6.1).
 * - Ownership guard (AC-6.2): an actor without `ACCESS_API_ADMIN` can only
 *   extend a subscription that belongs to their own billing customer.
 *   Admins with `ACCESS_API_ADMIN` bypass this check.
 *
 * Error mapping (mirrors sibling admin billing routes such as `addons.ts`):
 * - `VALIDATION_ERROR` → 422 (non-trialing sub, wrong effect kind, etc.)
 * - `NOT_FOUND` → 404
 * - Ownership / permission denied → 403
 * - `PROMO_CODE_MAX_USES` / `PROMO_CODE_MAX_USES_PER_CUSTOMER` → 409
 * - `INTERNAL_ERROR` → 500
 *
 * @module routes/billing/admin/subscription-trial-extension
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { assertSubscriptionOwnership, extendExistingSubscriptionTrial } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Request / Response schemas
// ---------------------------------------------------------------------------

/**
 * Body schema for the apply-trial-extension endpoint.
 *
 * Only `promoCodeId` is required — the subscription is identified via the URL
 * path param so the body stays minimal. The code must have a `trial_extension`
 * effect kind; the service rejects any other kind with VALIDATION_ERROR.
 */
export const AdminApplyTrialExtensionBodySchema = z.object({
    /**
     * UUID of the `billing_promo_codes` row to apply.
     * Must have `effect_kind = 'trial_extension'`.
     */
    promoCodeId: z
        .string({ message: 'promoCodeId must be a string' })
        .uuid({ message: 'promoCodeId must be a valid UUID' })
});

/**
 * Response schema for a successful trial extension.
 *
 * Mirrors `ExtendExistingSubscriptionTrialData` from the service layer,
 * serialized for the HTTP response.
 */
const AdminApplyTrialExtensionResponseSchema = z.object({
    /** UUID of the subscription that was extended */
    subscriptionId: z.string().uuid(),
    /** ISO 8601 string of the new `trial_end` after extension */
    newTrialEnd: z.string().datetime(),
    /** Number of calendar days added */
    daysAdded: z.number().int().positive(),
    /**
     * Whether the monthly MP preapproval needs next-charge-date reconciliation.
     * `false` for annual subscriptions. When `true`, the T-007 reconciler
     * must be triggered to avoid an early MP charge.
     */
    mpReconciliationPending: z.boolean(),
    /** UUID of the usage record created for auditability */
    usageRecordId: z.string().uuid()
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps typed service error codes to HTTP status codes.
 * Mirrors the pattern used in `apps/api/src/routes/billing/admin/addons.ts`.
 */
function mapServiceErrorToStatus(code: string | undefined): 400 | 403 | 404 | 409 | 422 | 500 {
    const statusMap: Record<string, 400 | 403 | 404 | 409 | 422 | 500> = {
        [ServiceErrorCode.NOT_FOUND]: 404,
        [ServiceErrorCode.VALIDATION_ERROR]: 422,
        [ServiceErrorCode.FORBIDDEN]: 403,
        // Promo code usage limit errors → 409 Conflict (not a client-data error)
        PROMO_CODE_MAX_USES: 409,
        PROMO_CODE_MAX_USES_PER_CUSTOMER: 409,
        [ServiceErrorCode.INTERNAL_ERROR]: 500
    };
    return statusMap[code ?? ''] ?? 500;
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/subscriptions/:subscriptionId/apply-trial-extension
 *
 * Applies a `trial_extension` promo code to an existing subscription.
 *
 * - Validates actor has `BILLING_PROMO_CODE_MANAGE`.
 * - Runs the AC-6.2 ownership guard unless actor has `ACCESS_API_ADMIN`.
 * - Delegates to `extendExistingSubscriptionTrial` (T-006).
 * - Returns the updated trial end and MP reconciliation flag.
 */
export const adminApplyTrialExtensionRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/apply-trial-extension',
    summary: 'Apply trial extension to subscription (admin)',
    description:
        'Applies a trial_extension promo code to an existing subscription. ' +
        'The subscription must be in trialing status. ' +
        'Annual subscriptions in trial are accepted; past-trial annual subs are rejected. ' +
        'Requires BILLING_PROMO_CODE_MANAGE. ' +
        'Actors without ACCESS_API_ADMIN can only operate on subscriptions belonging to their own billing customer.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_PROMO_CODE_MANAGE],
    requestParams: {
        subscriptionId: z
            .string({ message: 'Subscription ID must be a string' })
            .uuid({ message: 'Subscription ID must be a valid UUID' })
    },
    requestBody: AdminApplyTrialExtensionBodySchema,
    responseSchema: AdminApplyTrialExtensionResponseSchema,
    // POST on an *existing* subscription → return 200 OK (not 201 Created)
    successStatusCode: 200,
    options: {
        // Stricter rate limit: this is a write mutation with billing side-effects
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const subscriptionId = params.subscriptionId as string;
        const { promoCodeId } = body as { promoCodeId: string };
        const livemode = env.NODE_ENV === 'production';

        apiLogger.info(
            { subscriptionId, promoCodeId, actorId: actor.id },
            'Admin applying trial extension to subscription'
        );

        // ------------------------------------------------------------------
        // AC-6.2 ownership guard.
        //
        // Admin actors with ACCESS_API_ADMIN bypass the check via
        // `actorHasAdmin: true` so the helper returns { success: true }
        // immediately without a DB query.
        //
        // Non-admin actors must supply a `billingCustomerId` that matches the
        // subscription's customer. The middleware injects billingCustomerId from
        // the session; if it is absent the actor has no billing customer context
        // and the request is rejected with 403.
        // ------------------------------------------------------------------
        const actorHasAdmin = actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) ?? false;

        if (!actorHasAdmin) {
            const billingCustomerId = c.get('billingCustomerId') as string | undefined | null;
            if (!billingCustomerId) {
                throw new HTTPException(403, {
                    message: 'Billing customer context required for non-admin actors'
                });
            }

            const ownershipResult = await assertSubscriptionOwnership({
                subscriptionId,
                billingCustomerId,
                actorHasAdmin: false
            });

            if (!ownershipResult.success) {
                const status = ownershipResult.error.code === 'NOT_FOUND' ? 404 : 403;
                throw new HTTPException(status as 403 | 404, {
                    message: ownershipResult.error.message
                });
            }
        }

        // ------------------------------------------------------------------
        // Delegate to the service operation (T-006).
        // All validation (status, effect kind, limits) is handled atomically
        // inside the service. The route trusts the typed error codes.
        // ------------------------------------------------------------------
        const result = await extendExistingSubscriptionTrial({
            subscriptionId,
            promoCodeId,
            actorId: actor.id,
            livemode
        });

        if (!result.success) {
            const status = mapServiceErrorToStatus(result.error.code);
            throw new HTTPException(status as 403 | 404 | 409 | 422 | 500, {
                message: result.error.message
            });
        }

        apiLogger.info(
            {
                subscriptionId,
                promoCodeId,
                newTrialEnd: result.data.newTrialEnd.toISOString(),
                daysAdded: result.data.daysAdded,
                mpReconciliationPending: result.data.mpReconciliationPending,
                actorId: actor.id
            },
            'Admin trial extension applied successfully'
        );

        return {
            subscriptionId: result.data.subscriptionId,
            newTrialEnd: result.data.newTrialEnd.toISOString(),
            daysAdded: result.data.daysAdded,
            mpReconciliationPending: result.data.mpReconciliationPending,
            usageRecordId: result.data.usageRecordId
        };
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

/**
 * Admin subscription trial extension sub-router.
 *
 * Mounted under `/subscriptions` by `apps/api/src/routes/billing/admin/index.ts`.
 * The full path is therefore:
 *   POST /api/v1/admin/billing/subscriptions/:subscriptionId/apply-trial-extension
 */
export const adminSubscriptionTrialExtensionRouter = createRouter();
adminSubscriptionTrialExtensionRouter.route('/', adminApplyTrialExtensionRoute);
