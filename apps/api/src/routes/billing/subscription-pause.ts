/**
 * Self-serve Subscription Pause / Resume Routes (SPEC-143 #29)
 *
 * Host-facing endpoints that pause or resume the authenticated user's own
 * subscription:
 *
 * - POST /api/v1/protected/billing/me/subscription-pause
 * - POST /api/v1/protected/billing/me/subscription-resume
 *
 * These deliberately live OUTSIDE the `/subscriptions` namespace. qzpay-hono
 * ships its own `POST /subscriptions/:id/pause` + `/resume`; a path like
 * `/subscriptions/me/pause` collides with it (Hono matches `:id='me'`) and also
 * trips the `/subscriptions`-scoped billing admin-guard + ownership middlewares.
 * The `/me/subscription-*` shape sidesteps all three.
 *
 * A host self-pause is ALWAYS "full": it stops billing (qzpay pauses the
 * MercadoPago preapproval and flips the local status) AND suspends service
 * (hides the owner's accommodations from public reads and edit-locks them via
 * the shared `setOwnerServiceSuspension` helper). Resume reverts both.
 *
 * This mirrors the admin pause/resume side effects in `qzpay-admin-hooks.ts`,
 * but runs them inline here because the self-serve tier does not go through the
 * qzpay-hono admin routes/hooks. Unlike admin pause there is no `suspendService`
 * flag — the self-serve pause is unconditionally full.
 *
 * @module routes/billing/subscription-pause
 */

import { billingSubscriptionEvents, getDb } from '@repo/db';
import { SubscriptionPauseResumeResponseSchema, SubscriptionStatusEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { clearEntitlementCache } from '../../middlewares/entitlement';
import { setOwnerServiceSuspension } from '../../services/subscription-pause.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { type SimpleRouteInterface, createSimpleRoute } from '../../utils/route-factory';

/**
 * Resolve the billing instance + the caller's billing customer, throwing the
 * standard HTTP errors when billing is not configured or the user has no
 * billing account. Shared by both handlers.
 */
function resolveBillingContext(c: Parameters<SimpleRouteInterface['handler']>[0]) {
    if (!c.get('billingEnabled')) {
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
    return { billing, billingCustomerId };
}

/**
 * Handler for the self-serve pause. Pauses the caller's active (or trialing)
 * subscription and applies the full service suspension.
 */
export const handleSelfServePause = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
    const { billing, billingCustomerId } = resolveBillingContext(c);
    const actor = getActorFromContext(c);

    const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
    const target = subscriptions.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
    );
    if (!target) {
        throw new HTTPException(404, { message: 'No active subscription to pause' });
    }

    // 1. Billing dimension: qzpay pauses the MP preapproval and flips the local
    //    status (no charges during the pause).
    const paused = await billing.subscriptions.pause(target.id);

    // 2. Service dimension: a self-pause is always full, so suspend the owner's
    //    listings. actor.id is the owner user id (billing_customers.external_id).
    const db = getDb();
    const { accommodationsUpdated } = await setOwnerServiceSuspension({
        userId: actor.id,
        suspended: true,
        db
    });

    // 3. Audit + entitlement cache invalidation.
    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: target.id,
        newStatus: SubscriptionStatusEnum.PAUSED,
        triggerSource: 'host-pause',
        metadata: { userId: actor.id, accommodationsUpdated }
    });
    clearEntitlementCache(billingCustomerId);

    apiLogger.info(
        {
            subscriptionId: target.id,
            customerId: billingCustomerId,
            userId: actor.id,
            accommodationsUpdated
        },
        'Host self-pause applied'
    );

    return {
        success: true,
        subscriptionId: target.id,
        status: paused.status,
        accommodationsUpdated
    };
};

/**
 * Handler for the self-serve resume. Resumes the caller's paused subscription
 * and clears the service suspension.
 */
export const handleSelfServeResume = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
    const { billing, billingCustomerId } = resolveBillingContext(c);
    const actor = getActorFromContext(c);

    const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
    const target = subscriptions.find((sub) => sub.status === 'paused');
    if (!target) {
        throw new HTTPException(404, { message: 'No paused subscription to resume' });
    }

    // 1. Billing dimension: qzpay resumes the MP preapproval and flips status.
    const resumed = await billing.subscriptions.resume(target.id);

    // 2. Service dimension: clear the suspension (idempotent — safe even if the
    //    pause was somehow not service-suspending).
    const db = getDb();
    const { accommodationsUpdated } = await setOwnerServiceSuspension({
        userId: actor.id,
        suspended: false,
        db
    });

    // 3. Audit + entitlement cache invalidation.
    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: target.id,
        newStatus: SubscriptionStatusEnum.ACTIVE,
        triggerSource: 'host-resume',
        metadata: { userId: actor.id, accommodationsUpdated }
    });
    clearEntitlementCache(billingCustomerId);

    apiLogger.info(
        {
            subscriptionId: target.id,
            customerId: billingCustomerId,
            userId: actor.id,
            accommodationsUpdated
        },
        'Host self-resume applied'
    );

    return {
        success: true,
        subscriptionId: target.id,
        status: resumed.status,
        accommodationsUpdated
    };
};

/**
 * POST /api/v1/protected/billing/me/subscription-pause
 */
export const selfServePauseRoute = createSimpleRoute({
    method: 'post',
    path: '/me/subscription-pause',
    summary: 'Pause your own subscription',
    description:
        "Pauses the authenticated user's active subscription. Always a full pause: stops billing and hides/edit-locks the owner's accommodations until resume.",
    tags: ['Billing', 'Subscriptions'],
    responseSchema: SubscriptionPauseResumeResponseSchema,
    handler: handleSelfServePause
});

/**
 * POST /api/v1/protected/billing/me/subscription-resume
 */
export const selfServeResumeRoute = createSimpleRoute({
    method: 'post',
    path: '/me/subscription-resume',
    summary: 'Resume your own subscription',
    description:
        "Resumes the authenticated user's paused subscription, restarting billing and restoring the owner's accommodations.",
    tags: ['Billing', 'Subscriptions'],
    responseSchema: SubscriptionPauseResumeResponseSchema,
    handler: handleSelfServeResume
});

const subscriptionPauseRouter = createRouter();
subscriptionPauseRouter.route('/', selfServePauseRoute);
subscriptionPauseRouter.route('/', selfServeResumeRoute);

export { subscriptionPauseRouter };
