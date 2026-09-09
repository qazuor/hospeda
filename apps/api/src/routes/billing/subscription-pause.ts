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
 * The `/me/subscription-*` shape sidesteps all three — which is also why the
 * target subscription id below travels in the JSON body instead of the path.
 *
 * ### HOS-1278: the request now NAMES the subscription
 *
 * Before this, the route took no body at all and guessed the caller's
 * "current" subscription via `getByCustomerId().filter(...).find(...)` —
 * whichever active/trialing row the storage adapter happened to return. That
 * is ambiguous the moment a customer holds more than one subscription: a host
 * auto-promoted from a paying tourist, a dual host/commerce owner, or (worst
 * of all) a partner, since this route has never been host-exclusive (see the
 * comment on `resolveOwnTargetSubscription` below). `subscriptionId` is now
 * REQUIRED in the body; the route only verifies it belongs to the caller — it
 * does not pick on their behalf.
 *
 * A self-pause is ALWAYS "full" on the BILLING dimension: it stops billing
 * (qzpay pauses the MercadoPago preapproval and flips the local status). The
 * SERVICE-suspension dimension is domain-dependent (HOS-1278): only an
 * ACCOMMODATION-domain subscription hides/edit-locks the owner's
 * accommodations via `setOwnerServiceSuspension` — a commerce
 * (gastronomy/experience) subscription's listing visibility is instead owned
 * entirely by the shared `reconcileSubscriptionLinkedEntities` bridge below,
 * which every domain gets unconditionally. Calling `setOwnerServiceSuspension`
 * for a non-accommodation subscription used to flip `users.serviceSuspended`
 * or nothing at all — silently suspending an unrelated accommodation portfolio
 * for a dual host/commerce owner, or doing nothing for a commerce-only owner
 * with no accommodations (masking that gastronomy/experience pause never hid
 * anything before the HOS-1280 bridge wiring).
 *
 * This mirrors the admin pause/resume side effects in `qzpay-admin-hooks.ts`,
 * but runs them inline here because the self-serve tier does not go through the
 * qzpay-hono admin routes/hooks. Unlike admin pause there is no `suspendService`
 * flag — the self-serve pause is unconditionally full on whichever dimension
 * applies to the subscription's own domain.
 *
 * @module routes/billing/subscription-pause
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptionEvents, getDb } from '@repo/db';
import {
    SubscriptionPauseResumeRequestSchema,
    SubscriptionPauseResumeResponseSchema,
    SubscriptionStatusEnum
} from '@repo/schemas';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { clearEntitlementCache } from '../../middlewares/entitlement';
import { recordPauseProviderRefusal } from '../../services/billing/pause-refusal-audit';
import { isAccommodationDomainSubscription } from '../../services/billing/plan-domain-guard';
import { reconcilePartnerForSubscription } from '../../services/partner-reconcile.service';
import { reconcileSubscriptionLinkedEntities } from '../../services/subscription-linked-entities.service';
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
 * Parses `{ subscriptionId }` out of the request body (HOS-1278). Shared by
 * both handlers so a missing/invalid body fails the same way for pause and
 * resume.
 *
 * @throws {HTTPException} 400 when the body is missing or fails validation.
 */
async function parseSubscriptionId(
    c: Parameters<SimpleRouteInterface['handler']>[0]
): Promise<string> {
    const body = await c.req.json().catch(() => null);
    const parseResult = SubscriptionPauseResumeRequestSchema.safeParse(body);
    if (!parseResult.success) {
        throw new HTTPException(400, {
            message: 'Missing or invalid subscriptionId in request body'
        });
    }
    return parseResult.data.subscriptionId;
}

/**
 * Resolves the caller-named target subscription and verifies it is theirs
 * (HOS-1278).
 *
 * This REPLACES the old `getByCustomerId().filter(...).find(...)` guess.
 * `billing.subscriptions.get()` reads local storage by id — the same
 * single-subscription lookup `billing-ownership.middleware.ts`,
 * `subscription-status.ts` and the admin qzpay hooks already use — so no new
 * risky `getByCustomerId(...).find(...)` pattern is introduced here.
 *
 * A subscription that does not exist and one that belongs to a different
 * customer answer identically: 404. Per `apps/api/docs/error-contract.md`, a
 * foreign resource must never answer 403 — that would confirm the id exists.
 * This route is not host-exclusive (`resolveBillingContext` only requires a
 * `billingCustomerId`), so a partner reaching it with their own partner
 * subscription id is a legitimate, ownership-verified call — see the
 * `reconcilePartnerForSubscription` call below for how that domain is
 * handled, not rejected here.
 *
 * @throws {HTTPException} 404 when the subscription does not exist or is not
 *   owned by `billingCustomerId`.
 */
async function resolveOwnTargetSubscription(input: {
    billing: QZPayBilling;
    billingCustomerId: string;
    subscriptionId: string;
}): Promise<NonNullable<Awaited<ReturnType<QZPayBilling['subscriptions']['get']>>>> {
    const { billing, billingCustomerId, subscriptionId } = input;
    const target = await billing.subscriptions.get(subscriptionId).catch(() => undefined);
    if (!target || target.customerId !== billingCustomerId) {
        apiLogger.warn(
            { subscriptionId, billingCustomerId },
            'Self-serve pause/resume: subscription not found or not owned by caller'
        );
        throw new HTTPException(404, { message: 'Subscription not found' });
    }
    return target;
}

/**
 * Handler for the self-serve pause. Pauses the caller-NAMED (HOS-1278)
 * active/trialing subscription and applies the domain-appropriate service
 * suspension.
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
    const subscriptionId = await parseSubscriptionId(c);

    // HOS-1278: the caller names the subscription; this only verifies
    // ownership. Replaces the old `getByCustomerId().filter(...).find(...)`
    // guess, which could not tell one of the customer's several subscriptions
    // apart from another.
    const target = await resolveOwnTargetSubscription({
        billing,
        billingCustomerId,
        subscriptionId
    });

    // HOS-246: a subscription that is scheduled for cancellation
    // (`cancelAtPeriodEnd=true`) must NOT be pausable. Pausing suspends the
    // owner's listings immediately, cutting short the soft-cancel grace window
    // (the already-cancelled user would lose access before the period end they
    // paid for). This mirrors the resume guard from HOS-236 and the
    // `!isCancelScheduled` gate the dashboard `canPause` uses. `cancelAtPeriodEnd`
    // is Hospeda's soft-cancel signal (set by `softCancelSubscription`).
    //
    // Status check runs FIRST: a named subscription that is not active/trialing
    // (paused, cancelled, expired, courtesy, ...) is not pausable regardless of
    // cancelAtPeriodEnd, and answers the same 404 the old "nothing found" case
    // did — this route never distinguished "doesn't exist" from "exists but is
    // not in a pausable state" (see `resolveOwnTargetSubscription` for the
    // separate not-owned-by-caller 404).
    if (target.status !== 'active' && target.status !== 'trialing') {
        throw new HTTPException(404, { message: 'No active subscription to pause' });
    }
    if (target.cancelAtPeriodEnd === true) {
        throw new HTTPException(409, {
            message:
                'PAUSE_NOT_ALLOWED_CANCELLATION_SCHEDULED: This subscription is scheduled for cancellation and cannot be paused'
        });
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

    // HOS-1280: the write above is durable (qzpay already committed the pause
    // at MercadoPago and locally) so this is the right point for the bridge —
    // before it, there is nothing to reconcile; after it, the entity caches and
    // commerce listing visibility would silently drift from the real status.
    // Without this, a paused commerce (gastronomy/experience) subscription's
    // listing stayed PUBLIC with billing stopped, and unlike accommodation
    // there is no 6-hourly cron to self-heal it.
    await reconcileSubscriptionLinkedEntities({
        subscriptionId: target.id,
        subscriptionStatus: SubscriptionStatusEnum.PAUSED,
        source: 'host-pause'
    });
    // This route is not host-exclusive despite its "host self-pause" framing —
    // `resolveBillingContext` only requires a `billingCustomerId` in context,
    // so any billing customer (including a partner) can reach it and pause the
    // subscription they named (verified as theirs by
    // `resolveOwnTargetSubscription` above). No-op for a non-partner
    // subscription.
    await reconcilePartnerForSubscription({
        subscriptionId: target.id,
        subscriptionStatus: SubscriptionStatusEnum.PAUSED,
        source: 'host-pause'
    });

    // 2. Service dimension: ONLY an ACCOMMODATION-domain subscription's pause
    //    hides/edit-locks the owner's accommodations (HOS-1278). Before this,
    //    `setOwnerServiceSuspension` ran unconditionally regardless of which
    //    subscription was paused — flipping `users.serviceSuspended` (and thus
    //    every accommodation that same user owns) off a gastronomy/experience
    //    pause that has nothing to do with accommodations. The dual
    //    host/commerce owner (`host-provider@local.test`) is exactly the case
    //    this silently broke: pausing their restaurant subscription used to
    //    suspend their listings too. A commerce subscription's own listing
    //    visibility is already fully handled by the bridge above
    //    (`reconcileSubscriptionLinkedEntities`), unconditionally, for every
    //    domain — so gating this call loses nothing for commerce and stops it
    //    from reaching across domains for accommodation.
    //
    //    `isAccommodationDomainSubscription` hydrates `productDomain` itself
    //    (qzpay's `getByCustomerId`/`get()` never populate it) and fails OPEN
    //    toward accommodation on a hydration error, same posture as its other
    //    caller in `plan-domain-guard.ts`.
    const db = getDb();
    let accommodationsUpdated = 0;
    if (await isAccommodationDomainSubscription(target)) {
        ({ accommodationsUpdated } = await setOwnerServiceSuspension({
            userId: actor.id,
            suspended: true,
            db
        }));
    }

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
 * Handler for the self-serve resume. Resumes the caller-NAMED (HOS-1278)
 * paused subscription and clears whichever domain-appropriate service
 * suspension applied to it.
 */
export const handleSelfServeResume = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
    const { billing, billingCustomerId } = resolveBillingContext(c);
    const actor = getActorFromContext(c);
    const subscriptionId = await parseSubscriptionId(c);

    // HOS-1278: same explicit-id resolution as pause — see
    // `resolveOwnTargetSubscription`.
    const target = await resolveOwnTargetSubscription({
        billing,
        billingCustomerId,
        subscriptionId
    });

    // HOS-236: a paused subscription that is scheduled for cancellation
    // (`cancelAtPeriodEnd=true`) must NOT be resumable — resuming reactivates the
    // MP preapproval and re-charges a subscription the user already cancelled.
    // Only a genuinely user-paused subscription (no pending cancellation) can be
    // resumed here. `cancelAtPeriodEnd` is Hospeda's soft-cancel signal (the
    // `softCancelSubscription` service sets exactly this flag) and mirrors the
    // `isCancelScheduled` gate the dashboard UI uses for the Resume button.
    //
    // Status check first, same rationale as pause above.
    if (target.status !== 'paused') {
        throw new HTTPException(404, { message: 'No paused subscription to resume' });
    }
    if (target.cancelAtPeriodEnd === true) {
        throw new HTTPException(409, {
            message:
                'RESUME_NOT_ALLOWED_CANCELLATION_SCHEDULED: This subscription is scheduled for cancellation and cannot be resumed'
        });
    }

    // 1. Billing dimension: qzpay resumes the MP preapproval and flips status.
    const resumed = await billing.subscriptions.resume(target.id);

    // HOS-1280: same bridge call as pause above, same reasoning — the resume
    // already committed, so this is where the listing goes back PUBLIC.
    await reconcileSubscriptionLinkedEntities({
        subscriptionId: target.id,
        subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
        source: 'host-resume'
    });
    await reconcilePartnerForSubscription({
        subscriptionId: target.id,
        subscriptionStatus: SubscriptionStatusEnum.ACTIVE,
        source: 'host-resume'
    });

    // 2. Service dimension: clear the suspension — but ONLY for an
    //    ACCOMMODATION-domain subscription (HOS-1278), mirroring the pause
    //    gate above. Resuming a gastronomy/experience subscription must never
    //    touch `users.serviceSuspended`; that owner's accommodations (if any)
    //    were never suspended by THIS subscription's pause, so there is
    //    nothing here for resume to clear. Idempotent — safe even if the
    //    pause was somehow not service-suspending.
    const db = getDb();
    let accommodationsUpdated = 0;
    if (await isAccommodationDomainSubscription(target)) {
        ({ accommodationsUpdated } = await setOwnerServiceSuspension({
            userId: actor.id,
            suspended: false,
            db
        }));
    }

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
        "Pauses the caller-named subscription (body: { subscriptionId }), which must belong to the authenticated user. Always stops billing. For an accommodation-domain subscription, also hides/edit-locks the owner's accommodations until resume; for a commerce (gastronomy/experience) subscription, the linked listing's visibility is instead handled by the shared subscription-linked-entities bridge.",
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
        "Resumes the caller-named paused subscription (body: { subscriptionId }), which must belong to the authenticated user. Always restarts billing, and reverts whichever service-suspension effect applied to that subscription's domain (see the pause route).",
    tags: ['Billing', 'Subscriptions'],
    responseSchema: SubscriptionPauseResumeResponseSchema,
    handler: handleSelfServeResume
});

const subscriptionPauseRouter = createRouter();
subscriptionPauseRouter.route('/', selfServePauseRoute);
subscriptionPauseRouter.route('/', selfServeResumeRoute);

export { subscriptionPauseRouter };
