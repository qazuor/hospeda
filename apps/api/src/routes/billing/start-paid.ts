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
 * - `billingInterval: 'monthly'` -> service delegation.
 * - `billingInterval: 'annual'` -> HTTP 501 (D1 annual follow-up).
 * - `promoCode` present -> forwarded to the service, which honors only
 *   `free_trial_extension`-type promos (SPEC-126 D9). Unknown or
 *   discount-type codes surface as HTTP 422.
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
import {
    SubscriptionCheckoutError,
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
 * Map a `SubscriptionCheckoutError` from the service layer to an HTTP
 * exception. Keeping this mapping at the route boundary keeps the
 * service framework-agnostic.
 */
function mapServiceErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MONTHLY_PRICE':
            return new HTTPException(404, { message: err.message });
        case 'INVALID_PROMO_CODE':
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
 * - 404 when the plan slug is unknown or has no active monthly price.
 * - 422 when the promo code is not a valid `free_trial_extension` (D9).
 * - 500 when the qzpay create call returns no init point (adapter bug),
 *   or when any other unexpected error bubbles out.
 * - 501 when `billingInterval === 'annual'` (D1 annual follow-up).
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

    if (body.billingInterval === 'annual') {
        throw new HTTPException(501, {
            message:
                'Annual paid subscriptions are not yet supported (SPEC-126 D1 annual follow-up)'
        });
    }

    try {
        const result = await initiatePaidMonthlySubscription({
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
                planSlug: body.planSlug
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

startPaidRouter.route('/', startPaidSubscriptionRoute);

export { startPaidRouter };
