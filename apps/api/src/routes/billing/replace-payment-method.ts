/**
 * Replace-Payment-Method Route (HOS-348 Part B)
 *
 * `POST /api/v1/protected/billing/subscriptions/:localId/replace-payment-method`
 *
 * Lets a customer whose subscription is `past_due` fix it themselves: mints
 * a brand-new MercadoPago preapproval on their current plan and returns its
 * `checkoutUrl`. The old preapproval is cancelled only once the new one is
 * confirmed authorized — see
 * `services/billing/past-due-payment-method-replacement.service.ts` for the
 * full mechanism and the (owner-approved) decision to forgive the unpaid
 * period rather than collect it through the new preapproval.
 *
 * Row lookup + eligibility checks live HERE (not in the service), mirroring
 * `checkout-retry.ts`'s split: ownership/existence is an HTTP concern, the
 * service only mints.
 *
 * @module routes/billing/replace-payment-method
 */

import { billingSubscriptions, eq, getDb } from '@repo/db';
import {
    ReplacePaymentMethodParamsSchema,
    type ReplacePaymentMethodResponse,
    ReplacePaymentMethodResponseSchema,
    SubscriptionStatusEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { idempotencyKeyMiddleware } from '../../middlewares/idempotency-key.js';
import { replacePastDuePaymentMethod } from '../../services/billing/past-due-payment-method-replacement.service.js';
import { SubscriptionCheckoutError } from '../../services/billing/subscription-checkout-error.js';
import { mapSubscriptionCheckoutErrorToHttp } from '../../services/billing/subscription-checkout-error-http.js';
import { createRouter } from '../../utils/create-app.js';
import { createCRUDRoute } from '../../utils/route-factory.js';
import {
    buildNotificationUrl,
    buildPaymentMethodReturnUrl,
    resolveReturnUrlLocale
} from './checkout-return-urls.js';

/**
 * Handler for the replace-payment-method endpoint.
 *
 * Error order follows `apps/api/docs/error-contract.md`: 401 (session,
 * enforced by the mounting middleware) → 400 (no billing customer) → 404
 * (row does not exist, or belongs to someone else — NEVER 403, a 403 would
 * confirm the id exists) → 422 (well-formed but not applicable to this
 * row's current state — not past_due, or an annual interval this Part B
 * scope does not support yet).
 */
export const handleReplacePaymentMethod = async (
    c: Context,
    params: { localId: string }
): Promise<ReplacePaymentMethodResponse> => {
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

    const db = getDb();
    const [row] = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            status: billingSubscriptions.status,
            billingInterval: billingSubscriptions.billingInterval
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, params.localId))
        .limit(1);

    // Foreign/nonexistent rows both answer 404 — never 403, which would
    // confirm the id exists to a caller who does not own it.
    if (!row || row.customerId !== billingCustomerId) {
        throw new HTTPException(404, { message: 'Subscription not found' });
    }

    if (row.status !== SubscriptionStatusEnum.PAST_DUE) {
        throw new HTTPException(422, {
            message: `Subscription is in state '${row.status}', not eligible for payment method replacement`
        });
    }

    // HOS-348 Part B scope: monthly only. Replacing an annual preapproval
    // would silently change the customer's billing cadence without consent
    // — out of scope here, not a bug. `billingInterval` on the DB row uses
    // qzpay/drizzle vocabulary ('month' | 'year'), unlike the request-facing
    // 'monthly' | 'annual' used elsewhere in this file.
    if (row.billingInterval === 'year') {
        throw new HTTPException(422, {
            message: 'Annual subscriptions are not yet supported by payment method replacement'
        });
    }

    const locale = resolveReturnUrlLocale(c);

    try {
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: billingCustomerId,
            pastDueSubscription: { id: row.id, planId: row.planId },
            paymentMethodReturnUrl: buildPaymentMethodReturnUrl(locale),
            notificationUrl: buildNotificationUrl()
        });

        return { checkoutUrl: result.checkoutUrl, reused: result.reused };
    } catch (error) {
        if (error instanceof SubscriptionCheckoutError) {
            throw mapSubscriptionCheckoutErrorToHttp(error);
        }
        throw error;
    }
};

/**
 * POST /api/v1/protected/billing/subscriptions/{localId}/replace-payment-method
 */
export const replacePaymentMethodRoute = createCRUDRoute({
    method: 'post',
    path: '/{localId}/replace-payment-method',
    summary: 'Replace the payment method on a past-due subscription',
    description:
        'Mints a fresh MercadoPago preapproval on the subscription’s current plan for a past-due customer to authorize. The old preapproval is cancelled only once the new one confirms authorized.',
    tags: ['Billing', 'Subscriptions'],
    requestParams: ReplacePaymentMethodParamsSchema.shape,
    responseSchema: ReplacePaymentMethodResponseSchema,
    successStatusCode: 200,
    handler: async (c, params) =>
        handleReplacePaymentMethod(c, { localId: params.localId as string })
});

/**
 * Router that exposes the replace-payment-method endpoint, guarded by the
 * SAME `X-Idempotency-Key` contract `/start-paid` uses — see
 * `middlewares/idempotency-key.ts`. This is layer 1 of the two-layer
 * idempotency the service module documents; layer 2 (the in-flight-attempt
 * reuse check) lives in `replacePastDuePaymentMethod` itself.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside
 * `checkoutRetryRouter` and `subscriptionStatusRouter`.
 */
const replacePaymentMethodRouter = createRouter();
replacePaymentMethodRouter.use(
    '/:localId/replace-payment-method',
    idempotencyKeyMiddleware({ operation: 'hospeda.replace_payment_method' })
);
replacePaymentMethodRouter.route('/', replacePaymentMethodRoute);

export { replacePaymentMethodRouter };
