/**
 * User Self-Service Subscription Cancel Route (SPEC-147 T-006)
 *
 * Exposes the user-facing soft-cancel endpoint:
 *
 *   `POST /api/v1/protected/billing/subscriptions/:id/cancel`
 *
 * Ships behind the `HOSPEDA_USER_CANCEL_ENABLED` feature flag (default
 * `false`). Flag off returns 404 NOT_FOUND — the route behaves as though
 * it does not exist, which is the safe "feature dark" signal.
 *
 * Ownership is enforced in the service layer: `softCancelSubscription`
 * verifies `subscription.customerId === params.customerId` before writing
 * any state (defence-in-depth). The handler itself gates on
 * `billingCustomerId` being present (set by `billingCustomerMiddleware`).
 * Note: this route is mounted BEFORE the qzpay wrapper in `billing/index.ts`
 * to take first-match priority over qzpay-hono's prebuilt
 * `POST /subscriptions/:id/cancel`; `billingAdminGuardMiddleware` is applied
 * via a dedicated `cancelWrapper` at mount time.
 *
 * `billingAdminGuardMiddleware` has `cancel` in `allowedSubPaths` (SPEC-147
 * T-006), so non-admin callers reach this handler. Admins also reach it via
 * the same path (no extra restriction — they can still soft-cancel on behalf
 * of themselves; hard-cancel remains the admin `DELETE /subscriptions/:id`
 * path via QZPay's admin routes + `onBeforeSubscriptionCancel` hook).
 *
 * ### Error mapping from ServiceError
 *
 * The `softCancelSubscription` service throws typed `ServiceError`s. This
 * handler maps the codes that the service can realistically throw to HTTP
 * responses consistent with the rest of the billing surface:
 *
 * | ServiceErrorCode         | HTTP |
 * |--------------------------|------|
 * | NOT_FOUND                | 404  |
 * | FORBIDDEN                | 403  |
 * | VALIDATION_ERROR         | 422  |
 * | PROVIDER_ERROR           | 502  |
 * | PROVIDER_RATE_LIMITED    | 503  |
 * | PROVIDER_TIMEOUT         | 504  |
 * | anything else            | 500  |
 *
 * @module routes/billing/subscription-cancel
 */

import {
    UserCancelSubscriptionRequestSchema,
    UserCancelSubscriptionResponseSchema
} from '@repo/schemas';
import type { UserCancelSubscriptionResponse } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { softCancelSubscription } from '../../services/subscription-cancel.service';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps a `ServiceErrorCode` thrown by `softCancelSubscription` to an HTTP
 * status code. Mirrors the SPEC-149 error-mapping pattern used by
 * `plan-change.ts` and `start-paid.ts`.
 */
function mapServiceErrorToStatus(code: ServiceErrorCode): number {
    switch (code) {
        case ServiceErrorCode.NOT_FOUND:
            return 404;
        case ServiceErrorCode.FORBIDDEN:
            return 403;
        case ServiceErrorCode.VALIDATION_ERROR:
            return 422;
        case ServiceErrorCode.PROVIDER_ERROR:
            return 502;
        case ServiceErrorCode.PROVIDER_RATE_LIMITED:
            return 503;
        case ServiceErrorCode.PROVIDER_TIMEOUT:
            return 504;
        default:
            return 500;
    }
}

// ---------------------------------------------------------------------------
// Handler (extracted for testability)
// ---------------------------------------------------------------------------

/**
 * Handler for the user self-service subscription cancel endpoint.
 *
 * @param c - Hono context (actor + billingCustomerId already set by middleware)
 * @param params - Route params, must include `id` (subscription ID)
 * @param body - Parsed request body (reason optional)
 * @returns Soft-cancel confirmation payload
 *
 * @throws {HTTPException} 404 when `HOSPEDA_USER_CANCEL_ENABLED` is false
 * @throws {HTTPException} 503 when billing is not configured or unavailable
 * @throws {HTTPException} 400 when the caller has no billing customer
 * @throws {HTTPException} 404 when the subscription is not found (via ServiceError)
 * @throws {HTTPException} 403 when the subscription belongs to another customer (defence-in-depth)
 * @throws {HTTPException} 422 when the subscription is not in a cancellable state
 * @throws {HTTPException} 502/503/504 on provider errors (SPEC-149 path)
 */
export const handleUserCancelSubscription = async (
    // biome-ignore lint/suspicious/noExplicitAny: Context type param cannot be narrowed from generic createCRUDRoute handler signature; matches pattern in plan-change.ts
    c: Context<any>,
    params: Record<string, unknown>,
    body: Record<string, unknown>
): Promise<UserCancelSubscriptionResponse> => {
    // Feature flag gate — flag off → the route does not exist for callers.
    if (!env.HOSPEDA_USER_CANCEL_ENABLED) {
        throw new HTTPException(404, {
            message: 'Not found'
        });
    }

    // Billing availability checks (mirror plan-change.ts / start-paid.ts pattern).
    const billingEnabled = c.get('billingEnabled');
    if (!billingEnabled) {
        throw new HTTPException(503, { message: 'Billing service is not configured' });
    }

    const billingCustomerId = c.get('billingCustomerId');
    if (!billingCustomerId) {
        throw new HTTPException(400, { message: 'No billing account found' });
    }

    const billing = getQZPayBilling();
    if (!billing) {
        throw new HTTPException(503, { message: 'Billing service is not available' });
    }

    // Extract and validate the subscription ID from path params.
    const subscriptionId = params.id;
    if (!subscriptionId || typeof subscriptionId !== 'string') {
        throw new HTTPException(400, { message: 'Missing subscription ID' });
    }

    // Validate the request body (optional reason).
    const parseResult = UserCancelSubscriptionRequestSchema.safeParse(body);
    if (!parseResult.success) {
        throw new HTTPException(400, {
            message: 'Invalid request body',
            cause: parseResult.error.flatten()
        });
    }

    const { reason } = parseResult.data;

    // Extract actor for notification context (email/name are optional on Actor).
    const actor = getActorFromContext(c);
    const recipientEmail = (actor as { email?: string }).email;
    const recipientName = (actor as { name?: string }).name ?? recipientEmail;

    // Resolve a human-readable plan name for the notification (best-effort).
    let planName: string | undefined;
    try {
        const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
        const thisSub = subscriptions.find((s) => s.id === subscriptionId);
        if (thisSub) {
            const plan = await billing.plans.get(thisSub.planId);
            planName = (plan?.name as string | undefined) ?? undefined;
        }
    } catch {
        // Plan name lookup is best-effort — failure must not block the cancel.
    }

    try {
        const result = await softCancelSubscription({
            billing,
            subscriptionId,
            customerId: billingCustomerId,
            reason,
            recipientEmail,
            recipientName: recipientName ?? undefined,
            userId: actor.id,
            planName
        });

        apiLogger.info(
            {
                subscriptionId,
                customerId: billingCustomerId,
                reason,
                accessUntil: result.accessUntil
            },
            'User self-service soft-cancel completed'
        );

        return result;
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }

        if (error instanceof ServiceError) {
            const status = mapServiceErrorToStatus(error.code);

            apiLogger.warn(
                {
                    subscriptionId,
                    customerId: billingCustomerId,
                    errorCode: error.code,
                    errorMessage: error.message
                },
                'User cancel: ServiceError from softCancelSubscription'
            );

            throw new HTTPException(status as 400 | 403 | 404 | 422 | 500 | 502 | 503 | 504, {
                message: error.message
            });
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { subscriptionId, customerId: billingCustomerId, error: errorMessage },
            'User self-service cancel: unexpected error'
        );

        throw new HTTPException(500, {
            message: 'Failed to cancel subscription. Please try again or contact support.'
        });
    }
};

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/protected/billing/subscriptions/:id/cancel
 *
 * User self-service soft-cancel. Ships dark behind
 * `HOSPEDA_USER_CANCEL_ENABLED=true` (default false).
 *
 * Ownership verified by `billingOwnershipMiddleware` (runs before this
 * handler). Feature flag check is the first thing the handler does.
 */
export const userCancelSubscriptionRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/cancel',
    summary: 'Cancel your subscription (soft-cancel)',
    description:
        'Initiates a user self-service soft-cancel. Access continues until the end of the current billing period. Requires HOSPEDA_USER_CANCEL_ENABLED=true.',
    tags: ['Billing', 'Subscriptions'],
    requestParams: {
        id: z.string().describe('The subscription ID to cancel')
    },
    requestBody: UserCancelSubscriptionRequestSchema,
    responseSchema: UserCancelSubscriptionResponseSchema,
    successStatusCode: 200,
    handler: handleUserCancelSubscription
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const subscriptionCancelRouter = createRouter();
subscriptionCancelRouter.route('/', userCancelSubscriptionRoute);

export { subscriptionCancelRouter };
