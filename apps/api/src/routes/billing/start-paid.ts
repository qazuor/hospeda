/**
 * Start-Paid Subscription Route (SPEC-126 D1)
 *
 * Entry point for the paid subscription flow. Creates a local subscription
 * in a pending state, provisions the provider-hosted checkout, and returns
 * the redirect URL plus a TTL after which the abandoned-pending cron will
 * flip the row to `abandoned`.
 *
 * Routes:
 * - POST /api/v1/protected/billing/subscriptions/start-paid
 *
 * Branch matrix:
 * - `billingInterval: 'monthly'` → MercadoPago preapproval via
 *   `billing.subscriptions.create({ mode: 'paid' })` (SPEC-124 wiring).
 * - `billingInterval: 'annual'` → MercadoPago Checkout Pro one-time
 *   payment for the full annual amount. Implemented in a follow-up commit
 *   (SPEC-126 D1 annual); rejected with HTTP 501 here so the contract is
 *   stable from day one.
 *
 * Promo codes:
 * Accepted in the request body for API stability, but rejected with HTTP
 * 501 because the only meaningful type for monthly recurring is
 * `free_trial_days_extension`, which is added later in this spec (D9).
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
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Time-to-live applied to a pending-provider subscription before the
 * `abandoned-pending-subs` cron (SPEC-126 D6) flips it to `abandoned`.
 *
 * 30 minutes is enough for a user to complete a typical MP checkout
 * round-trip and short enough to keep zombie rows out of the system.
 */
const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/**
 * Public path the user is redirected to after authorizing the recurring
 * charge in MercadoPago. Built once at module load because both URLs
 * come from validated env vars and never change at runtime.
 *
 * The `ref` query parameter carries the local subscription UUID so the
 * return page can poll the status endpoint without depending on the URL
 * fragment MercadoPago tacks on.
 */
function buildPaymentMethodReturnUrl(localSubscriptionId: string): string {
    return `${env.HOSPEDA_SITE_URL}/billing/return?ref=${encodeURIComponent(localSubscriptionId)}`;
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
 * Resolve a plan by its slug (Hospeda treats `QZPayPlan.name` as the slug,
 * mirroring `trial.service.ts:124`).
 *
 * Returns `null` if no plan matches. Active-only plans are not enforced
 * here because the route's 404 should mention "plan not found", and the
 * billing admin owns plan activation state separately.
 */
async function resolvePlanBySlug(
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>,
    planSlug: string
) {
    const plansResult = await billing.plans.list();
    return plansResult.data.find((p) => p.name === planSlug) ?? null;
}

/**
 * Resolve the monthly price of a plan. qzpay-core uses `'month'` with
 * `intervalCount: 1` for monthly; the multi-month variants (quarterly,
 * semi_annual) have the same `'month'` interval but different counts
 * and are reserved for plan-change flows.
 */
interface PriceShape {
    id: string;
    billingInterval: string;
    intervalCount: number;
    active: boolean;
}

function findMonthlyPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'month' && p.intervalCount === 1) ??
        null
    );
}

/**
 * Handler for the start-paid endpoint.
 *
 * Extracted from the route definition so it can be unit-tested directly
 * with a synthetic Hono context. The annual branch and promo-code
 * branches return HTTP 501 here; they are filled in by follow-up
 * commits in SPEC-126.
 *
 * Errors:
 * - 400 when the caller has no billing customer on session.
 * - 404 when the plan slug is unknown or has no monthly price.
 * - 422 when the resolved plan name does not match the requested slug
 *   (defense-in-depth — `plans.list().find()` already filters on name).
 * - 500 when qzpay returns a sub without a `providerInitPoint` (the
 *   payment adapter is misconfigured — surface loudly).
 * - 501 when `billingInterval === 'annual'` (SPEC-126 D1 annual is a
 *   follow-up) or `promoCode` is provided (SPEC-126 D9 is a follow-up).
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

    if (body.promoCode !== undefined) {
        throw new HTTPException(501, {
            message:
                'Promo codes for paid subscriptions are not yet supported (SPEC-126 D9 follow-up)'
        });
    }

    if (body.billingInterval === 'annual') {
        throw new HTTPException(501, {
            message:
                'Annual paid subscriptions are not yet supported (SPEC-126 D1 annual follow-up)'
        });
    }

    const plan = await resolvePlanBySlug(billing, body.planSlug);

    if (!plan) {
        throw new HTTPException(404, {
            message: `Plan '${body.planSlug}' not found`
        });
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);

    if (!monthlyPrice) {
        throw new HTTPException(404, {
            message: `Plan '${body.planSlug}' has no active monthly price`
        });
    }

    try {
        const subscription = await billing.subscriptions.create({
            customerId: billingCustomerId,
            planId: plan.id,
            priceId: monthlyPrice.id,
            mode: 'paid',
            billingInterval: 'monthly',
            paymentMethodReturnUrl: buildPaymentMethodReturnUrl(''),
            notificationUrl: buildNotificationUrl(),
            metadata: {
                source: 'start-paid-monthly',
                createdBy: 'subscription-flow'
            }
        });

        const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;

        if (!checkoutUrl) {
            apiLogger.error(
                {
                    localSubscriptionId: subscription.id,
                    customerId: billingCustomerId,
                    planId: plan.id
                },
                'Paid subscription created without providerInitPoint — payment adapter misconfigured'
            );

            throw new HTTPException(500, {
                message: 'Payment provider did not return a checkout URL'
            });
        }

        // Rewrite the return URL now that we know the local sub id. The qzpay
        // create call needs *some* return URL up front (MP rejects empty
        // back_url), but the final URL must carry the local UUID so the front
        // can poll the status endpoint. The placeholder is harmless: the user
        // is redirected via `checkoutUrl`, not via `paymentMethodReturnUrl`.
        const returnUrl = buildPaymentMethodReturnUrl(subscription.id);

        apiLogger.info(
            {
                localSubscriptionId: subscription.id,
                customerId: billingCustomerId,
                planId: plan.id,
                planSlug: body.planSlug,
                returnUrl
            },
            'Paid subscription initiated, awaiting provider authorization'
        );

        const expiresAt = new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString();

        return {
            checkoutUrl,
            localSubscriptionId: subscription.id,
            expiresAt
        };
    } catch (error) {
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
