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
 * - `promoCode` present (monthly only) -> forwarded to the service,
 *   which honors only `free_trial_extension`-type promos (SPEC-126 D9).
 *   Unknown or discount-type codes surface as HTTP 422.
 *
 * @module routes/billing/start-paid
 */

import {
    StartPaidSubscriptionRequestSchema,
    StartPaidSubscriptionResponseSchema
} from '@repo/schemas';
import type { StartPaidSubscriptionResponse } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
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
 * MercadoPago `back_url` for the preapproval. MP requires a non-empty
 * `back_url` at create time; the actual checkout URL the user is
 * redirected to is `providerInitPoint` so this placeholder is harmless.
 * A follow-up could rewrite it post-create to embed the local sub UUID,
 * but the front already gets the UUID from the response and uses
 * `?ref=<localId>` on its own return page.
 */
function buildPaymentMethodReturnUrl(): string {
    return `${env.HOSPEDA_SITE_URL}/billing/return`;
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
 * The front-end receives `localSubscriptionId` in the response body
 * and persists it in sessionStorage BEFORE redirecting to MP, so the
 * URLs themselves don't need to carry the id. `cancelled=1` lets the
 * UI render an "abandoned checkout" message instead of the
 * success-pending spinner.
 */
function buildAnnualSuccessUrl(): string {
    return `${env.HOSPEDA_SITE_URL}/billing/return`;
}

function buildAnnualCancelUrl(): string {
    return `${env.HOSPEDA_SITE_URL}/billing/return?cancelled=1`;
}

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
 * - 422 when the promo code is not a valid `free_trial_extension` (D9).
 * - 500 when the qzpay create call returns no init point (adapter bug),
 *   or when any other unexpected error bubbles out.
 * - 503 when billing is not configured.
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

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
        });
    }

    try {
        const result =
            body.billingInterval === 'annual'
                ? await initiatePaidAnnualSubscription({
                      customerId: billingCustomerId,
                      planSlug: body.planSlug,
                      billing,
                      urls: {
                          successUrl: buildAnnualSuccessUrl(),
                          cancelUrl: buildAnnualCancelUrl(),
                          notificationUrl: buildNotificationUrl()
                      },
                      statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
                  })
                : await initiatePaidMonthlySubscription({
                      customerId: billingCustomerId,
                      planSlug: body.planSlug,
                      billing,
                      urls: {
                          paymentMethodReturnUrl: buildPaymentMethodReturnUrl(),
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
