/**
 * Start-Paid Subscription Route (SPEC-126 D1)
 *
 * Entry point for the paid subscription flow. The route is a thin HTTP
 * layer: it validates context (billing enabled, billing customer present)
 * and request body, rejects unsupported branches, then delegates to
 * {@link initiatePaidMonthlySubscription} which encapsulates all the
 * qzpay-facing logic.
 *
 * Routes:
 * - POST /api/v1/protected/billing/subscriptions/start-paid
 *
 * Branch matrix:
 * - `billingInterval: 'monthly'` -> {@link initiatePaidMonthlySubscription}
 *   (preapproval/recurring via MP).
 * - `billingInterval: 'annual'` -> {@link initiatePaidAnnualSubscription}
 *   (ALSO a recurring preapproval since HOS-171 §7.2, at a 12-month cadence —
 *   it used to be a one-time upfront Checkout charge and therefore never
 *   renewed; now it does).
 * - `promoCode` present (BOTH branches, SPEC-262 T-012 P2) -> forwarded to the
 *   service, which honors:
 *     - `trial_extension` -> extra `freeTrialDays` on the preapproval's
 *       `free_trial`, on BOTH intervals.
 *     - `discount` -> lowered preapproval amount, FAIL-CLOSED, on BOTH intervals.
 *     - `comp` -> a `status='comp'` subscription with NO MercadoPago charge; the
 *       response carries `appliedEffect: 'comp'` and an in-app success URL.
 *   Unknown / inactive codes surface as HTTP 422; a discount that MP rejects
 *   (after fail-closed cancellation) surfaces as HTTP 502.
 *
 * @module routes/billing/start-paid
 */

import { TEST_DAILY_PLAN } from '@repo/billing';
import type { StartPaidSubscriptionResponse } from '@repo/schemas';
import {
    ServiceErrorCode,
    StartPaidSubscriptionRequestSchema,
    StartPaidSubscriptionResponseSchema
} from '@repo/schemas';
import { isAccommodationSubscription, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../../lib/billing-provider-error';
import { getPostHogClient } from '../../lib/posthog';
import { captureBillingError } from '../../lib/sentry';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../middlewares/idempotency-key';
import { mapSubscriptionCheckoutErrorToHttp } from '../../services/billing/subscription-checkout-error-http';
import { BillingCustomerSyncService } from '../../services/billing-customer-sync';
import {
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription,
    SubscriptionCheckoutError
} from '../../services/subscription-checkout.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';
import {
    buildAnnualCancelUrl,
    buildAnnualSuccessUrl,
    buildNotificationUrl,
    buildPaymentMethodReturnUrl,
    DEFAULT_RETURN_URL_LOCALE,
    resolveReturnUrlLocale,
    SUPPORTED_RETURN_URL_LOCALES
} from './checkout-return-urls';

// NOTE: annual success/cancel URL builders moved to the shared
// `checkout-return-urls.ts` (HOS-123 T-005) so the reactivation routes reuse
// the exact same locale-prefixed URLs. A `pending` outcome URL would point at
// `${HOSPEDA_SITE_URL}/${RETURN_URL_LOCALE}/suscriptores/checkout/pending/`
// but the current subscription-checkout service only accepts success +
// cancel. Pending payments today fall back to the cancel URL until the
// service is extended to thread the pending URL through to MP's
// `back_urls.pending`. Tracked as a follow-up.

/**
 * Handler for the start-paid endpoint.
 *
 * Errors:
 * - 400 when the caller has no billing customer on session.
 * - 404 when the plan slug is unknown, has no active price for the
 *   requested interval, or (annual only) the resolved customer cannot
 *   be loaded.
 * - 422 when the promo code is unknown / inactive / not classifiable,
 *   or when the payment provider rejects the request as a validation error
 *   (e.g. invalid card — maps to `VALIDATION_ERROR` / HTTP 400 via global handler).
 * - 500 when the qzpay create call returns no init point (adapter bug),
 *   or when any other unexpected error bubbles out.
 * - 502 when the payment provider returns a 5xx or unrecognised error
 *   (`PROVIDER_ERROR` via global error handler, SPEC-149), OR when a discount
 *   code's FAIL-CLOSED preapproval mutation is rejected by MP and the
 *   just-created subscription is cancelled (`DISCOUNT_APPLY_FAILED`, SPEC-262).
 * - 503 when billing is not configured, or the payment provider is
 *   rate-limiting us (`PROVIDER_RATE_LIMITED`, SPEC-149).
 * - 504 when the payment provider times out (`PROVIDER_TIMEOUT`, SPEC-149).
 */
export const handleStartPaidSubscription = async (
    c: Context,
    body: {
        planSlug: string;
        billingInterval: 'monthly' | 'annual';
        promoCode?: string;
    }
): Promise<StartPaidSubscriptionResponse> => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        throw new HTTPException(503, {
            message: 'Billing service is not configured'
        });
    }

    const actor = getActorFromContext(c);

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
        });
    }

    // HOS-189: the billing_customers row is normally created once at signup
    // (the user.create.after hook), and billingCustomerMiddleware only looks it
    // up — it deliberately never creates it. If the row is missing for any
    // reason (accidental deletion, a billing-test-reset, a signup-hook race, a
    // migration), fail-CLOSED with an opaque 400 would leave checkout dead. So
    // self-heal here: ensure the customer exists before creating the preapproval,
    // exactly as HOS-171 specified for this branch ("ensureCustomerExists
    // first"). Idempotent — a no-op when the row already exists (returns the
    // existing id). throwOnError:false keeps a sync failure from masking the real
    // outcome; the null-guard below still surfaces the 400 if it truly cannot be
    // resolved.
    let billingCustomerId = c.get('billingCustomerId');

    if (!billingCustomerId && actor.email) {
        const syncService = new BillingCustomerSyncService(billing, { throwOnError: false });
        billingCustomerId = await syncService.ensureCustomerExists({
            userId: actor.id,
            email: actor.email,
            name: actor.name
        });
        if (billingCustomerId) {
            apiLogger.info(
                { userId: actor.id, customerId: billingCustomerId },
                'start-paid: billing customer was missing and has been ensured on demand (HOS-189)'
            );
        }
    }

    if (!billingCustomerId) {
        throw new HTTPException(400, {
            message: 'No billing account found'
        });
    }

    const locale = resolveReturnUrlLocale(c);

    try {
        const existingSubscriptions =
            await billing.subscriptions.getByCustomerId(billingCustomerId);

        // SPEC-262 H2: block checkout when the customer already has ANY active
        // ACCOMMODATION subscription (active, trialing, OR comp). Creating a second
        // subscription on top of an existing one causes ambiguous entitlements —
        // two subs for the same customer, neither clearly dominant.
        // Comp subs are perpetual (100-year far-future) so the user cannot "wait
        // them out" like a soft-cancel; they should contact support.
        // SPEC-239 isolation: filter to accommodation-domain subs FIRST using the
        // same predicate as the entitlement middleware, so a customer with an active
        // COMMERCE subscription is never wrongly blocked here.
        const hasActiveAccommodationSub = existingSubscriptions.some((sub) => {
            if (!isAccommodationSubscription(sub)) return false;
            // A soft-cancelled sub (cancelAtPeriodEnd=true) is intentionally NOT
            // caught here — the dedicated SPEC-147 guard below handles it with the
            // more specific SUBSCRIPTION_CANCEL_PENDING message. comp subs are
            // perpetual (no cancelAtPeriodEnd) so they still match.
            if (sub.cancelAtPeriodEnd === true) return false;
            // Cast to string — QZPay's type union does not include 'comp' (our
            // Hospeda-specific custom status) so a direct === comparison fails tsc.
            const status = sub.status as string;
            return status === 'active' || status === 'trialing' || status === 'comp';
        });
        if (hasActiveAccommodationSub) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You already have an active subscription. To change your plan, use the plan-change endpoint.',
                undefined,
                'ALREADY_SUBSCRIBED'
            );
        }

        // SPEC-147 T-008 / Q7 guard: the cancel wins.
        // If the customer has an existing ACCOMMODATION subscription with
        // cancelAtPeriodEnd=true, block re-subscription until the cancellation
        // finalises. Creating a second subscription while a soft-cancel is winding
        // down causes an ambiguous overlap. The user must wait for the finalization
        // cron to flip the soft-cancelled sub to 'cancelled'.
        // SPEC-239 isolation: filter to accommodation-domain subs — a soft-cancelled
        // commerce sub must never block an accommodation checkout.
        const hasSoftCancelledSub = existingSubscriptions.some(
            (sub) =>
                isAccommodationSubscription(sub) &&
                (sub.status === 'active' || sub.status === 'trialing') &&
                sub.cancelAtPeriodEnd === true
        );
        if (hasSoftCancelledSub) {
            // HOS-232: the recovery path is now un-cancel, not "wait". Starting a
            // second subscription over a live soft-cancelled preapproval would
            // create a duplicate live preapproval (double-charge risk), so this
            // stays a hard block — but the user can reverse the cancellation with
            // POST /subscriptions/:id/uncancel to keep their subscription.
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Your subscription is scheduled to cancel at period end. Un-cancel it to keep your subscription instead of starting a new one.',
                undefined,
                'SUBSCRIPTION_CANCEL_PENDING'
            );
        }

        // SPEC-148 T-006 guard: reject checkout onto a disabled plan.
        // Resolve the plan by slug before invoking the service so that a
        // disabled (retired) plan is rejected with 410 PLAN_DISABLED instead
        // of falling through to PLAN_NOT_FOUND or a provider error. The check
        // mirrors `resolvePlanBySlug` in subscription-checkout.service.ts —
        // QZPayPlan.active is the canonical active flag.
        //
        // Testing-only exemption (HOSPEDA_SHOW_TEST_BILLING_PLAN): the hidden
        // daily test plan ({@link TEST_DAILY_PLAN}) is seeded with
        // `active: false` on purpose — that is what keeps it off the public
        // plans list (`/api/v1/public/plans` filters `active: true`). It MUST
        // stay subscribable here despite being inactive; the AUTHORITATIVE
        // gate on whether it can actually be subscribed to is
        // `resolvePlanBySlug` in `subscription-checkout.service.ts`, which
        // returns `null` (→ PLAN_NOT_FOUND) for this slug when the env flag
        // is off. Exempting the active-check here does NOT make the plan
        // subscribable when the flag is off — it only stops this earlier
        // guard from short-circuiting BEFORE that real gate runs.
        const plansResult = await billing.plans.list();
        const targetPlan = plansResult.data.find((p) => p.name === body.planSlug) ?? null;
        if (
            targetPlan !== null &&
            targetPlan.active === false &&
            body.planSlug !== TEST_DAILY_PLAN.slug
        ) {
            throw new ServiceError(
                ServiceErrorCode.PLAN_DISABLED,
                'This plan is no longer available. Please choose an active plan.',
                undefined,
                'PLAN_DISABLED'
            );
        }

        // Resolve the interval price ONCE, shared by both the pre-decision
        // `checkout_started` event and the post-decision `checkout_completed`
        // event (HOS-122). Best-effort: the daily test plan has only a 'day'
        // price, so `priceForInterval` resolves to `undefined` (no 'month'/'year'
        // match) and `amountMajor`/`currency` fall back to `null` via optional
        // chaining. This lookup is a pure array find and cannot throw.
        const priceForInterval = targetPlan?.prices.find((p) =>
            body.billingInterval === 'annual'
                ? p.billingInterval === 'year'
                : p.billingInterval === 'month'
        );
        // `unitAmount` is stored in centavos, but the payment_failed /
        // subscription_payment_succeeded events capture MP's transaction_amount
        // in MAJOR units (ARS pesos). Normalize to major units here so `amount`
        // has ONE unit across the whole checkout→payment funnel.
        const amountMajor =
            typeof priceForInterval?.unitAmount === 'number'
                ? priceForInterval.unitAmount / 100
                : null;

        // Fire-and-forget product analytics for checkout initiation. Wrapped in
        // try/catch so a misbehaving PostHog client can NEVER break the checkout
        // — this handler must proceed to initiate the subscription regardless of
        // analytics outcome. Mirrors the pattern in payment-logic.ts.
        try {
            getPostHogClient()?.capture({
                distinctId: actor.id,
                event: 'checkout_started',
                properties: {
                    planSlug: body.planSlug,
                    billingInterval: body.billingInterval,
                    promoCode: body.promoCode ?? null,
                    amount: amountMajor,
                    currency: priceForInterval?.currency ?? null
                }
            });
        } catch (phErr) {
            apiLogger.warn(
                {
                    userId: actor.id,
                    planSlug: body.planSlug,
                    error: phErr instanceof Error ? phErr.message : String(phErr)
                },
                'PostHog capture failed for checkout_started (non-blocking)'
            );
        }

        const result =
            body.billingInterval === 'annual'
                ? await initiatePaidAnnualSubscription({
                      customerId: billingCustomerId,
                      // SPEC-262 C1+H1: userId needed for full promo validation.
                      userId: actor.id,
                      planSlug: body.planSlug,
                      billing,
                      urls: {
                          successUrl: buildAnnualSuccessUrl(locale),
                          cancelUrl: buildAnnualCancelUrl(locale),
                          notificationUrl: buildNotificationUrl()
                      },
                      // No statementDescriptor: annual is a preapproval now
                      // (HOS-171 §7.2) and MercadoPago preapprovals have no
                      // statement-descriptor field — only the hosted checkout
                      // this replaced did. Monthly never set one either.
                      promoCode: body.promoCode
                  })
                : await initiatePaidMonthlySubscription({
                      customerId: billingCustomerId,
                      // SPEC-262 C1+H1: userId needed for full promo validation.
                      userId: actor.id,
                      planSlug: body.planSlug,
                      billing,
                      urls: {
                          paymentMethodReturnUrl: buildPaymentMethodReturnUrl(locale),
                          notificationUrl: buildNotificationUrl()
                      },
                      promoCode: body.promoCode
                  });

        apiLogger.info(
            {
                localSubscriptionId: result.localSubscriptionId,
                customerId: billingCustomerId,
                planSlug: body.planSlug,
                billingInterval: body.billingInterval
            },
            'Paid subscription initiated, awaiting provider authorization'
        );

        // HOS-122: outcome-side product analytics. Captured AFTER `result`
        // resolves, so it carries the normalized checkout `outcome` that
        // `checkout_started` structurally cannot (the trial/comp/discount/paid
        // decision is only known here). `appliedEffect` is absent for a plain
        // paid checkout, so normalize `undefined` → 'paid' — analytics must
        // never encode "property missing means paid". Stitchable to
        // `checkout_started` via `localSubscriptionId`. Same non-blocking
        // try/catch contract: analytics can never break checkout, and no event
        // is emitted when `initiatePaid*Subscription` throws (the outer catch
        // handles that path).
        try {
            // `trialGranted` is checked BEFORE falling back to 'paid': a card-first
            // trial has no appliedEffect (it is an ordinary MP redirect), so without
            // this the funnel would report every trial signup as a plain paid one and
            // trial→paid conversion (HOS-130) would have nothing to measure.
            // `comp`/`discount` still win — they describe what the money did, which is
            // the more specific fact when both are true.
            const outcome = result.appliedEffect ?? (result.trialGranted ? 'trial' : 'paid');
            getPostHogClient()?.capture({
                distinctId: actor.id,
                event: 'checkout_completed',
                properties: {
                    planSlug: body.planSlug,
                    billingInterval: body.billingInterval,
                    outcome,
                    /**
                     * Whether MercadoPago will defer the first charge, as its OWN
                     * dimension rather than folded into `outcome`.
                     *
                     * `outcome` is a single scalar, so when a checkout is both a
                     * trial and a discount it has to pick one — and it picks the
                     * money (`'discount'`), which would silently drop the trial
                     * from the funnel for exactly the customers most worth
                     * tracking. Since HOS-171 a trial COEXISTS with a discount, so
                     * that combination is normal, not an edge case.
                     */
                    trialGranted: result.trialGranted ?? false,
                    promoCode: body.promoCode ?? null,
                    promoCodeIgnored: result.promoCodeIgnored ?? false,
                    localSubscriptionId: result.localSubscriptionId,
                    amount: amountMajor,
                    currency: priceForInterval?.currency ?? null,
                    // Persist the last checkout outcome on the person for
                    // cohorting (HOS-122 D-10), mirroring how
                    // subscription_payment_succeeded $sets plan_status.
                    $set: { last_checkout_outcome: outcome }
                }
            });
        } catch (phErr) {
            apiLogger.warn(
                {
                    userId: actor.id,
                    planSlug: body.planSlug,
                    localSubscriptionId: result.localSubscriptionId,
                    error: phErr instanceof Error ? phErr.message : String(phErr)
                },
                'PostHog capture failed for checkout_completed (non-blocking)'
            );
        }

        return result;
    } catch (error) {
        if (error instanceof SubscriptionCheckoutError) {
            if (error.code === 'MISSING_INIT_POINT') {
                apiLogger.error(
                    {
                        customerId: billingCustomerId,
                        planSlug: body.planSlug
                    },
                    'Paid subscription created without providerInitPoint -- payment adapter misconfigured'
                );
            }
            throw mapSubscriptionCheckoutErrorToHttp(error);
        }

        if (error instanceof HTTPException) {
            throw error;
        }

        // Re-throw ServiceErrors as-is so the global error handler maps them
        // to their correct HTTP status codes (e.g. ALREADY_EXISTS → 409).
        // Must come BEFORE isBillingProviderError so domain-level ServiceErrors
        // (e.g. SPEC-147 cancel-pending gate) are not misidentified as provider errors.
        if (error instanceof ServiceError) {
            throw error;
        }

        // SPEC-149 Part B+C: detect QZPayProviderSyncError, map to typed
        // ServiceError (so the global handler returns 502/503/504/400 instead of
        // the generic 500), and capture to Sentry with billing tags.
        if (isBillingProviderError(error)) {
            const serviceError = mapProviderErrorToServiceError({
                error,
                operation: 'subscription_create'
            });

            // Extract providerStatus from the mapped ServiceError details
            // (ProviderErrorDetails shape from billing-provider-error.ts).
            const details = serviceError.details as
                | { providerStatus?: number; operation?: string }
                | undefined;

            captureBillingError(serviceError, {
                operation: 'start_paid_checkout',
                planId: body.planSlug,
                providerStatus: details?.providerStatus
            });

            throw serviceError;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                customerId: billingCustomerId,
                planSlug: body.planSlug,
                billingInterval: body.billingInterval,
                error: errorMessage
            },
            'Failed to start paid subscription'
        );

        throw new HTTPException(500, {
            message: 'Failed to start paid subscription. Please try again.'
        });
    }
};

/**
 * POST /api/v1/protected/billing/subscriptions/start-paid
 *
 * Initiates the paid subscription flow. See module docstring for the
 * complete behavior; see also the polling endpoint at
 * `GET /api/v1/protected/billing/subscriptions/:localId/status`.
 */
export const startPaidSubscriptionRoute = createCRUDRoute({
    method: 'post',
    path: '/start-paid',
    summary: 'Start a paid subscription',
    description:
        'Begins the paid subscription flow. Creates a local subscription in a pending state and provisions a provider-hosted checkout (MercadoPago preapproval for monthly).',
    tags: ['Billing', 'Subscriptions'],
    requestBody: StartPaidSubscriptionRequestSchema,
    responseSchema: StartPaidSubscriptionResponseSchema,
    successStatusCode: 201,
    handler: async (c, _params, body) =>
        handleStartPaidSubscription(c, {
            planSlug: body.planSlug as string,
            billingInterval: body.billingInterval as 'monthly' | 'annual',
            promoCode: body.promoCode as string | undefined
        })
});

/**
 * Router that exposes the start-paid endpoint.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside
 * `planChangeRouter` and `subscriptionStatusRouter`. Hono routes by
 * exact path so the three siblings coexist without conflict.
 */
const startPaidRouter = createRouter();

// Enforce X-Idempotency-Key on the mutating POST /start-paid endpoint
// (SPEC-143 T-143-60). Mount BEFORE the route handler so the middleware
// short-circuits missing-key requests with a 400 before the handler
// touches MP. Scoped to /start-paid only — the polling status endpoint
// (subscriptionStatusRouter) is a GET and does not need idempotency.
startPaidRouter.use('/start-paid', idempotencyKeyMiddleware({ operation: 'hospeda.start_paid' }));

startPaidRouter.route('/', startPaidSubscriptionRoute);

export { startPaidRouter };

/**
 * Exported helpers for unit testing locale resolution without spinning up
 * the full handler.
 */
export const _internals = {
    resolveReturnUrlLocale,
    SUPPORTED_RETURN_URL_LOCALES,
    DEFAULT_RETURN_URL_LOCALE
};
