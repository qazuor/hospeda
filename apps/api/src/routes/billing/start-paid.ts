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
 *   (one-time upfront charge via MP Checkout, SPEC-141 D1).
 * - `promoCode` present (BOTH branches, SPEC-262 T-012 P2) -> forwarded to the
 *   service, which honors:
 *     - `trial_extension` -> `freeTrialDays` (monthly only; ignored on annual).
 *     - `discount` -> lowered preapproval amount (monthly, FAIL-CLOSED) or a
 *       reduced one-time line-item (annual).
 *     - `comp` -> a `status='comp'` subscription with NO MercadoPago charge; the
 *       response carries `appliedEffect: 'comp'` and an in-app success URL.
 *   Unknown / inactive codes surface as HTTP 422; a discount that MP rejects
 *   (after fail-closed cancellation) surfaces as HTTP 502.
 *
 * @module routes/billing/start-paid
 */

import {
    ServiceErrorCode,
    StartPaidSubscriptionRequestSchema,
    StartPaidSubscriptionResponseSchema
} from '@repo/schemas';
import type { StartPaidSubscriptionResponse } from '@repo/schemas';
import { ServiceError, isAccommodationSubscription } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../../lib/billing-provider-error';
import { captureBillingError } from '../../lib/sentry';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../middlewares/idempotency-key';
import {
    SubscriptionCheckoutError,
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription
} from '../../services/subscription-checkout.service';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Supported locale values for the user-facing return URLs.
 *
 * Must stay in sync with `apps/web/src/lib/i18n.ts` SUPPORTED_LOCALES.
 * The checkout pages (`[lang]/suscriptores/checkout/{success,failure,pending}`)
 * exist for all three locales via Astro's `[lang]` routing.
 */
const SUPPORTED_RETURN_URL_LOCALES = ['es', 'en', 'pt'] as const;
type ReturnUrlLocale = (typeof SUPPORTED_RETURN_URL_LOCALES)[number];

/** Fallback locale when the user has no preference or the preference is unknown. */
const DEFAULT_RETURN_URL_LOCALE: ReturnUrlLocale = 'es';

/**
 * Resolves the locale to embed in MP return URLs from the authenticated user's
 * web language preference (`user.settings.languageWeb`).
 *
 * Falls back to `'es'` when:
 * - There is no authenticated user on the context.
 * - The user has no `settings.languageWeb` value.
 * - The stored value is not one of the three supported locales.
 *
 * @param c - Hono context carrying the Better Auth session user.
 * @returns A supported locale string for use in URL path prefixes.
 */
function resolveReturnUrlLocale(c: Context): ReturnUrlLocale {
    const user = c.get('user') as { settings?: Record<string, unknown> } | null | undefined;
    const rawLocale = user?.settings?.languageWeb;

    if (
        typeof rawLocale === 'string' &&
        (SUPPORTED_RETURN_URL_LOCALES as readonly string[]).includes(rawLocale)
    ) {
        return rawLocale as ReturnUrlLocale;
    }

    return DEFAULT_RETURN_URL_LOCALE;
}

/**
 * MercadoPago `back_url` for the preapproval (monthly subscriptions).
 *
 * MP requires a non-empty `back_url` at preapproval-create time and
 * redirects the user there after they authorise the recurring charge.
 * The URL MUST land on an existing route — Astro's locale middleware
 * rewrites unknown segments (e.g. `/billing/return`) into a 404 surface,
 * so we point directly at the checkout success page which already exists
 * at `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro` and
 * is set up to read `?status=` / `?preapproval_id=` query parameters MP
 * appends post-authorise.
 *
 * History: until 2026-05-21 this returned
 * `${HOSPEDA_SITE_URL}/billing/return`, which Astro's middleware rewrote
 * to `/es/return/` (404). Surfaced during staging smoke as Finding #8.
 *
 * @param locale - User's preferred return-URL locale (e.g. `'es'`, `'en'`, `'pt'`).
 */
function buildPaymentMethodReturnUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/success/`;
}

/**
 * Webhook destination for the MP preapproval. We pass the application-wide
 * URL explicitly so MercadoPago always reaches this API, even when a
 * legacy app-wide URL exists in the MP dashboard.
 */
function buildNotificationUrl(): string {
    return `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`;
}

/**
 * MP Checkout return URLs for the annual one-time flow.
 *
 * Checkout preferences accept three back_urls (success / failure / pending)
 * and MP redirects to the matching one based on payment outcome. The pages
 * already exist at:
 *
 *   - `[lang]/suscriptores/checkout/success.astro`
 *   - `[lang]/suscriptores/checkout/failure.astro`
 *   - `[lang]/suscriptores/checkout/pending.astro`
 *
 * Pointing the URLs there directly avoids the locale-middleware rewrite
 * that bit the monthly flow (Finding #8).
 *
 * @param locale - User's preferred return-URL locale.
 *
 * The front-end receives `localSubscriptionId` in the response body and
 * persists it in sessionStorage BEFORE redirecting to MP, so the URLs do
 * not need to carry the id. MP appends `?status=approved` /
 * `?payment_id=...` / `?preference_id=...` on its own at redirect time.
 */
function buildAnnualSuccessUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/success/`;
}

function buildAnnualCancelUrl(locale: ReturnUrlLocale): string {
    return `${env.HOSPEDA_SITE_URL}/${locale}/suscriptores/checkout/failure/`;
}

// NOTE: a `pending` outcome URL would point at
// `${HOSPEDA_SITE_URL}/${RETURN_URL_LOCALE}/suscriptores/checkout/pending/`
// but the current subscription-checkout service only accepts success +
// cancel. Pending payments today fall back to the cancel URL until the
// service is extended to thread the pending URL through to MP's
// `back_urls.pending`. Tracked as a follow-up.

/**
 * Map a `SubscriptionCheckoutError` from the service layer to an HTTP
 * exception. Keeping this mapping at the route boundary keeps the
 * service framework-agnostic.
 */
function mapServiceErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MONTHLY_PRICE':
        case 'NO_ANNUAL_PRICE':
        case 'NO_MATCHING_PRICE':
        case 'CUSTOMER_NOT_FOUND':
        case 'SUBSCRIPTION_NOT_FOUND':
            return new HTTPException(404, { message: err.message });
        case 'INVALID_PROMO_CODE':
        case 'SAME_PLAN':
        case 'NOT_AN_UPGRADE':
            return new HTTPException(422, { message: err.message });
        case 'DISCOUNT_APPLY_FAILED':
            // SPEC-262 T-012 P2: MP rejected our fail-closed discount mutation and
            // the just-created subscription was cancelled. The code itself is valid
            // (so NOT 422) — the payment provider refused the amount change. 502
            // (Bad Gateway) signals an upstream-provider failure, consistent with
            // the SPEC-149 provider-error mapping family.
            return new HTTPException(502, { message: err.message });
        case 'MISSING_INIT_POINT':
            return new HTTPException(500, { message: err.message });
        default: {
            // Defensive: the union should be exhaustive, but TS doesn't
            // enforce that downstream consumers add new codes here. Fall
            // back to a generic 500 with the original message.
            const exhaustive: never = err.code;
            void exhaustive;
            return new HTTPException(500, { message: err.message });
        }
    }
}

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

    const billingCustomerId = c.get('billingCustomerId');

    if (!billingCustomerId) {
        throw new HTTPException(400, {
            message: 'No billing account found'
        });
    }

    const actor = getActorFromContext(c);

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
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
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'An existing subscription is scheduled to cancel at period end. Cannot start a new subscription while a cancellation is pending. Please wait for the current period to end.',
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
        const plansResult = await billing.plans.list();
        const targetPlan = plansResult.data.find((p) => p.name === body.planSlug) ?? null;
        if (targetPlan !== null && targetPlan.active === false) {
            throw new ServiceError(
                ServiceErrorCode.PLAN_DISABLED,
                'This plan is no longer available. Please choose an active plan.',
                undefined,
                'PLAN_DISABLED'
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
                      statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR,
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
            throw mapServiceErrorToHttp(error);
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
