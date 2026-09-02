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
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { clearEntitlementCache } from '../../middlewares/entitlement';
import { recordPauseProviderRefusal } from '../../services/billing/pause-refusal-audit';
import { setOwnerServiceSuspension } from '../../services/subscription-pause.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute, type SimpleRouteInterface } from '../../utils/route-factory';

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
 *
 * A subscription with no MercadoPago preapproval has nothing to pause on the
 * billing side, so pausing it would suspend the owner's listings while changing
 * nothing about their charges. Those are rejected with a clear error
 * (SPEC-194 T-023, re-aimed at the real condition by HOS-995 — the interval was
 * never it).
 */
export const handleSelfServePause = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
    const { billing, billingCustomerId } = resolveBillingContext(c);
    const actor = getActorFromContext(c);

    const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
    const activeSubscriptions = subscriptions.filter(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
    );
    // HOS-246: a subscription that is scheduled for cancellation
    // (`cancelAtPeriodEnd=true`) must NOT be pausable. Pausing suspends the
    // owner's listings immediately, cutting short the soft-cancel grace window
    // (the already-cancelled user would lose access before the period end they
    // paid for). This mirrors the resume guard from HOS-236 and the
    // `!isCancelScheduled` gate the dashboard `canPause` uses. `cancelAtPeriodEnd`
    // is Hospeda's soft-cancel signal (set by `softCancelSubscription`).
    const target = activeSubscriptions.find((sub) => sub.cancelAtPeriodEnd !== true);
    if (!target) {
        // Distinguish "nothing active/trialing" from "the only candidate is a
        // cancellation in progress" so the caller gets an actionable error.
        if (activeSubscriptions.some((sub) => sub.cancelAtPeriodEnd === true)) {
            throw new HTTPException(409, {
                message:
                    'PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED: This subscription is scheduled for cancellation and cannot be paused'
            });
        }
        throw new HTTPException(404, { message: 'No active subscription to pause' });
    }

    // Precedence note (HOS-246): the soft-cancel guard above runs BEFORE this
    // one. So a subscription that is BOTH unpausable-for-lack-of-preapproval AND
    // scheduled for cancellation surfaces the 409 cancellation-scheduled error,
    // never this 400 — that is deliberate: "you already cancelled" is the
    // dominant, user-facing reason and applies regardless of anything else.
    //
    // HOS-995: this used to reject on `metadata.billingInterval === 'annual'`,
    // justified by "annual subscriptions are backed by a single MP payment, not
    // a recurring preapproval, so there is nothing to pause". HOS-171
    // (card-first) retired that premise outright — an annual subscription IS a
    // recurring preapproval today, at qzpay's 'annual' cadence (MP
    // `frequency: 12, frequency_type: 'months'`), and `create-annual-subscription.ts`
    // was deleted. The refusal outlived its reason, on a button the web
    // dashboard offers to annual subscribers anyway (`canPause` in
    // `SubscriptionDashboard.client.tsx` never looked at the interval), so an
    // annual host clicking Pause got a 400 naming an architecture that no longer
    // exists.
    //
    // What replaces it is the condition the old guard was reaching for and
    // missed: **there is no preapproval to pause**. That is a property of the
    // row, not of the interval. It catches the legacy annual one-time rows the
    // old comment described, and equally a Hospeda-owned trial or any other
    // pre-HOS-171 leftover carrying no `mercadopago` provider id — all of which
    // the interval check waved straight through. Pausing one of those suspends
    // the owner's listings while changing nothing on the billing side, which is
    // exactly the misleading state the original guard set out to prevent.
    //
    // Still NOT verified: that MercadoPago's pause endpoint behaves the same on
    // a twelve-month preapproval as on a one-month one. That is a manual sandbox
    // observation (see `status-needs-smoke-staging` on HOS-995), not something
    // this route can assert. What the route does instead is guarantee the
    // failure mode — see the try/catch below.
    if (!target.providerSubscriptionIds?.mercadopago) {
        throw new HTTPException(400, {
            message:
                'PAUSE_NO_PREAPPROVAL: This subscription has no MercadoPago preapproval to pause, ' +
                'so pausing it would suspend your listings without stopping any billing'
        });
    }

    // 1. Billing dimension: qzpay pauses the MP preapproval and flips the local
    //    status (no charges during the pause).
    //
    //    Wrapped so the failure is BOTH fail-closed and observable (HOS-995).
    //    Fail-closed it already was — throwing here skips the service suspension
    //    and the audit row below, so a pause MercadoPago refused never
    //    half-lands. What was missing is that the refusal left no trace beyond a
    //    log line, and an uncaught provider error surfaced as an opaque 500. Now
    //    it is a durable row carrying the interval and MP's own message, plus a
    //    typed 502 that names the provider as the cause.
    let paused: Awaited<ReturnType<typeof billing.subscriptions.pause>>;
    try {
        paused = await billing.subscriptions.pause(target.id);
    } catch (error) {
        await recordPauseProviderRefusal({
            subscriptionId: target.id,
            triggerSource: 'host-pause',
            billingInterval:
                typeof target.metadata?.billingInterval === 'string'
                    ? target.metadata.billingInterval
                    : null,
            error
        });
        apiLogger.error(
            {
                subscriptionId: target.id,
                customerId: billingCustomerId,
                userId: actor.id,
                billingInterval: target.metadata?.billingInterval,
                error: error instanceof Error ? error.message : String(error)
            },
            'Host self-pause: MercadoPago refused the pause, nothing was changed'
        );
        throw new HTTPException(502, {
            message:
                'PAUSE_PROVIDER_REFUSED: MercadoPago refused to pause this subscription. ' +
                'Nothing was changed; your listings are still online and billing continues.'
        });
    }

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
        eventType: BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_PAUSED,
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
    const pausedSubscriptions = subscriptions.filter((sub) => sub.status === 'paused');
    // HOS-236: a paused subscription that is scheduled for cancellation
    // (`cancelAtPeriodEnd=true`) must NOT be resumable — resuming reactivates the
    // MP preapproval and re-charges a subscription the user already cancelled.
    // Only a genuinely user-paused subscription (no pending cancellation) can be
    // resumed here. `cancelAtPeriodEnd` is Hospeda's soft-cancel signal (the
    // `softCancelSubscription` service sets exactly this flag) and mirrors the
    // `isCancelScheduled` gate the dashboard UI uses for the Resume button.
    const target = pausedSubscriptions.find((sub) => sub.cancelAtPeriodEnd !== true);
    if (!target) {
        // Distinguish "nothing paused" from "the paused sub is a cancellation in
        // progress" so the caller gets an actionable error instead of a generic 404.
        if (pausedSubscriptions.some((sub) => sub.cancelAtPeriodEnd === true)) {
            throw new HTTPException(409, {
                message:
                    'RESUME_NOT_ALLOWED_CANCELLATION_SCHEDULED: This subscription is scheduled for cancellation and cannot be resumed'
            });
        }
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
        eventType: BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_RESUMED,
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
