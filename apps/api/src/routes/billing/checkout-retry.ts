/**
 * Checkout-Retry Route (HOS-937 step 3, spec §7.5/§8.3)
 *
 * `POST /api/v1/protected/billing/subscriptions/:localId/checkout-retry`
 *
 * Reads the caller's own preapproval by id and answers with the recovery
 * spec §6.4 defines — the two failure outcomes are NOT the same thing:
 * - `pending`: the SAME MercadoPago object, still awaiting completion —
 *   send the user back to its OWN `init_point`.
 * - `cancelled`: MercadoPago cancelled the object (typically a card
 *   rejection). `payer_email` is not mutable on a MercadoPago preapproval,
 *   so there is no way to retry on the SAME object — a FRESH one is minted.
 *
 * This is what replaces the infinite loop of spec §8.3: today, once
 * MercadoPago cancels a preapproval, it keeps offering the user a "pay with
 * another method" button that can never work (`cancelled -> authorized` is
 * a forbidden MP transition). This endpoint is the deterministic exit.
 *
 * @module routes/billing/checkout-retry
 */

import { createMercadoPagoAdapter } from '@repo/billing';
import { billingSubscriptions, eq, getDb } from '@repo/db';
import {
    CheckoutRetryParamsSchema,
    type CheckoutRetryResponse,
    CheckoutRetryResponseSchema,
    SubscriptionStatusEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import {
    classifyPreapprovalStatus,
    recoverCancelledPreapproval
} from '../../services/billing/preapproval-recovery.service.js';
import { createRouter } from '../../utils/create-app.js';
import { apiLogger } from '../../utils/logger.js';
import { createCRUDRoute } from '../../utils/route-factory.js';
import {
    buildNotificationUrl,
    buildPaymentMethodReturnUrl,
    resolveReturnUrlLocale
} from './checkout-return-urls.js';

/** Statuses this endpoint short-circuits without any MercadoPago call. */
const ALREADY_ACTIVATED_STATUSES: ReadonlySet<string> = new Set([
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.TRIALING,
    SubscriptionStatusEnum.COMP
]);

/**
 * Handler for the checkout-retry endpoint.
 *
 * Error order follows `apps/api/docs/error-contract.md`: 401 (session,
 * enforced by the mounting middleware) → 400 (no billing customer / bad
 * param, the latter enforced by the request schema) → 404 (row does not
 * exist, or belongs to someone else — NEVER 403, a 403 would confirm the id
 * exists) → 422 (well-formed but not applicable to this row's state).
 */
export const handleCheckoutRetry = async (
    c: Context,
    params: { localId: string }
): Promise<CheckoutRetryResponse> => {
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
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, params.localId))
        .limit(1);

    // Foreign/nonexistent rows both answer 404 — never 403, which would
    // confirm the id exists to a caller who does not own it.
    if (!row || row.customerId !== billingCustomerId) {
        throw new HTTPException(404, { message: 'Subscription not found' });
    }

    if (ALREADY_ACTIVATED_STATUSES.has(row.status as string)) {
        return { recovery: 'authorized', checkoutUrl: null };
    }

    const metadata = (row.metadata ?? {}) as Record<string, unknown>;

    // Already-cancelled locally: reuse whatever this endpoint (or the
    // cancellation webhook, §6.5) already minted, rather than re-reading MP
    // or minting a second time.
    if (row.status === SubscriptionStatusEnum.CANCELLED) {
        if (
            typeof metadata.retryMintedLocalSubscriptionId === 'string' &&
            typeof metadata.retryMintedCheckoutUrl === 'string'
        ) {
            return { recovery: 'cancelled', checkoutUrl: metadata.retryMintedCheckoutUrl };
        }
    } else if (row.status !== SubscriptionStatusEnum.PENDING_PROVIDER) {
        // Not a checkout-recovery-shaped state (paused/past_due/expired/
        // abandoned/...) — this endpoint does not apply.
        throw new HTTPException(422, {
            message: `Subscription is in state '${row.status}', not eligible for checkout retry`
        });
    }

    const mpSubscriptionId = row.mpSubscriptionId;
    if (!mpSubscriptionId) {
        throw new HTTPException(422, { message: 'Subscription has no preapproval to check' });
    }

    const adapter = createMercadoPagoAdapter({ logger: qzpayLogger });

    const live = await adapter.subscriptions.retrieve(mpSubscriptionId);
    const classification = classifyPreapprovalStatus(live.status);

    if (classification === 'authorized') {
        return { recovery: 'authorized', checkoutUrl: null };
    }

    if (classification === 'pending') {
        const checkoutUrl = typeof metadata.checkoutUrl === 'string' ? metadata.checkoutUrl : null;
        return { recovery: 'pending', checkoutUrl };
    }

    if (classification === 'other') {
        // Paused/past_due/finished on a checkout that never activated is
        // unexpected but not actionable here — treat conservatively as
        // "keep waiting", never as cancelled (which would mint unnecessarily).
        apiLogger.warn(
            { localId: params.localId, mpStatus: live.status },
            'HOS-937 checkout-retry: unexpected live status for a non-activated subscription'
        );
        return { recovery: 'pending', checkoutUrl: null };
    }

    // classification === 'cancelled' — confirm (R-3), claim, mint.
    const locale = resolveReturnUrlLocale(c);
    const outcome = await recoverCancelledPreapproval({
        billing,
        paymentAdapter: adapter,
        localSubscription: {
            id: row.id,
            customerId: row.customerId,
            planId: row.planId,
            productDomain: (row as { productDomain?: string | null }).productDomain ?? null,
            metadata: row.metadata,
            mpSubscriptionId
        },
        paymentMethodReturnUrl: buildPaymentMethodReturnUrl(locale),
        notificationUrl: buildNotificationUrl(),
        db
    });

    if (outcome.kind === 'minted' || outcome.kind === 'already_minted') {
        return { recovery: 'cancelled', checkoutUrl: outcome.checkoutUrl };
    }
    if (outcome.kind === 'not_confirmed' || outcome.kind === 'claim_lost') {
        return { recovery: 'confirming', checkoutUrl: null };
    }

    // outcome.kind === 'unsupported' — a real data gap (unsupported product
    // domain, missing plan/price, missing mpPreapprovalPlanId). Well-formed
    // request, unprocessable server-side state → 422.
    throw new HTTPException(422, {
        message: 'Could not generate a new checkout attempt for this subscription'
    });
};

/**
 * POST /api/v1/protected/billing/subscriptions/{localId}/checkout-retry
 */
export const checkoutRetryRoute = createCRUDRoute({
    method: 'post',
    path: '/{localId}/checkout-retry',
    summary: 'Recover a checkout that did not come back authorized',
    description:
        'Reads the preapproval by id and returns the init_point of the SAME object (pending) or a FRESH one (cancelled) — see spec §6.4.',
    tags: ['Billing', 'Subscriptions'],
    requestParams: CheckoutRetryParamsSchema.shape,
    responseSchema: CheckoutRetryResponseSchema,
    successStatusCode: 200,
    handler: async (c, params) => handleCheckoutRetry(c, { localId: params.localId as string })
});

/**
 * Router that exposes the checkout-retry endpoint.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside
 * `subscriptionStatusRouter` and `linkPreapprovalRouter`.
 */
const checkoutRetryRouter = createRouter();
checkoutRetryRouter.route('/', checkoutRetryRoute);

export { checkoutRetryRouter };
