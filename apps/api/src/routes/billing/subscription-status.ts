/**
 * Subscription Status Polling Route
 *
 * API endpoint used by the front-end to poll for the status of a
 * locally-created subscription while the user is being redirected to
 * MercadoPago and back.
 *
 * Routes:
 * - GET /api/v1/protected/billing/subscriptions/:localId/status
 *
 * The front polls this endpoint every 2 seconds after the user returns
 * from MercadoPago and stops once the status flips to `active` (or to a
 * terminal state). The endpoint is read-only and side-effect free.
 *
 * @module routes/billing/subscription-status
 */

import {
    SubscriptionStatusEnum,
    SubscriptionStatusParamsSchema,
    SubscriptionStatusResponseSchema
} from '@repo/schemas';
import type { SubscriptionStatusResponse } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling } from '../../middlewares/billing';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Resolve the MercadoPago preapproval ID from a qzpay subscription, if any.
 *
 * After SPEC-124, qzpay-drizzle persists `providerSubscriptionIds` on every
 * subscription. The shape is a `Record<provider, providerId>` keyed by the
 * provider slug. For Hospeda we only care about MercadoPago.
 *
 * Returns `null` when:
 * - the subscription has no `providerSubscriptionIds` map (legacy rows), or
 * - the map exists but has no `mercadopago` entry (provider call still pending).
 */
function extractMpSubscriptionId(subscription: unknown): string | null {
    if (!subscription || typeof subscription !== 'object') {
        return null;
    }

    const providerIds = (subscription as { providerSubscriptionIds?: unknown })
        .providerSubscriptionIds;

    if (!providerIds || typeof providerIds !== 'object') {
        return null;
    }

    const mpId = (providerIds as Record<string, unknown>).mercadopago;

    return typeof mpId === 'string' && mpId.length > 0 ? mpId : null;
}

/**
 * Derive an `activatedAt` timestamp for the polling response.
 *
 * For an `active` subscription the activation moment is the start of the
 * current billing period (MercadoPago opens the period as soon as it
 * confirms the preapproval). For any other status the subscription is not
 * (yet) activated, so we return `null` regardless of whether older period
 * fields are populated.
 */
function deriveActivatedAt(status: SubscriptionStatusEnum, subscription: unknown): string | null {
    if (status !== SubscriptionStatusEnum.ACTIVE) {
        return null;
    }

    const periodStart = (subscription as { currentPeriodStart?: Date | string | null })
        .currentPeriodStart;

    if (!periodStart) {
        return null;
    }

    return periodStart instanceof Date
        ? periodStart.toISOString()
        : new Date(periodStart).toISOString();
}

/**
 * Vocabulary alignment between qzpay-core's subscription status union and
 * Hospeda's `SubscriptionStatusEnum`.
 *
 * The DB column ends up holding either:
 * - qzpay-vocabulary values when the row is written by qzpay-core (the
 *   `mode: 'paid'` create flow, plan changes, etc.) — `canceled` (1 L),
 *   `incomplete`, `incomplete_expired`, `unpaid`, ...
 * - Hospeda-vocabulary values when the row is updated by the webhook
 *   handler in `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`,
 *   which deliberately maps to `SubscriptionStatusEnum` before persisting
 *   (`cancelled` with 2 L's, `expired`, ...).
 *
 * The polling endpoint must accept both vocabularies and always surface a
 * Hospeda-vocabulary value to the front, so callers do not need to know
 * which writer last touched the row.
 *
 * `unpaid` is intentionally mapped to `PAST_DUE` because Hospeda does not
 * model an `unpaid` state separately — for the user-facing flow, an unpaid
 * recurring charge IS the past-due experience.
 */
const QZPAY_TO_HOSPEDA_STATUS: Record<string, SubscriptionStatusEnum> = {
    active: SubscriptionStatusEnum.ACTIVE,
    trialing: SubscriptionStatusEnum.TRIALING,
    past_due: SubscriptionStatusEnum.PAST_DUE,
    paused: SubscriptionStatusEnum.PAUSED,
    canceled: SubscriptionStatusEnum.CANCELLED,
    unpaid: SubscriptionStatusEnum.PAST_DUE,
    incomplete: SubscriptionStatusEnum.PENDING_PROVIDER,
    incomplete_expired: SubscriptionStatusEnum.ABANDONED
};

/**
 * Map a raw subscription status (qzpay vocabulary or already-Hospeda
 * vocabulary) into the `SubscriptionStatusEnum` returned by the polling
 * response.
 *
 * Returns `null` when the input is neither a known qzpay status nor a
 * known Hospeda enum value — callers surface that as a 500 because a
 * sub stored with an unknown status is a data-integrity bug that must
 * be inspected manually.
 */
function mapSubscriptionStatus(value: unknown): SubscriptionStatusEnum | null {
    if (typeof value !== 'string') {
        return null;
    }

    const mapped = QZPAY_TO_HOSPEDA_STATUS[value];

    if (mapped !== undefined) {
        return mapped;
    }

    const hospedaValues = Object.values(SubscriptionStatusEnum) as string[];

    return hospedaValues.includes(value) ? (value as SubscriptionStatusEnum) : null;
}

/**
 * Handler for the subscription status polling endpoint.
 *
 * Extracted from the route definition so it can be unit-tested directly
 * with a synthetic Hono context, mirroring the pattern used by
 * `handlePlanChange`.
 *
 * Errors:
 * - 400 when the caller has no billing customer on session.
 * - 403 when the subscription belongs to a different customer.
 * - 404 when the subscription does not exist.
 * - 500 when the subscription is stored with an unknown status (data bug).
 * - 503 when billing is not configured.
 */
export const handleGetSubscriptionStatus = async (
    c: Context,
    params: { localId: string }
): Promise<SubscriptionStatusResponse> => {
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

    const { localId } = params;
    const subscription = await billing.subscriptions.get(localId);

    if (!subscription) {
        throw new HTTPException(404, {
            message: 'Subscription not found'
        });
    }

    // Ownership check: the parent QZPay billing-ownership middleware runs only
    // on the pre-built routes, so custom routes must enforce this themselves.
    if (subscription.customerId !== billingCustomerId) {
        apiLogger.warn(
            {
                localId,
                requesterCustomerId: billingCustomerId,
                subscriptionCustomerId: subscription.customerId
            },
            'Rejected cross-customer subscription status access'
        );

        throw new HTTPException(403, {
            message: 'Forbidden'
        });
    }

    const status = mapSubscriptionStatus(subscription.status);

    if (status === null) {
        apiLogger.error(
            { localId, rawStatus: subscription.status },
            'Subscription stored with unknown status — manual inspection required'
        );

        throw new HTTPException(500, {
            message: 'Subscription is in an unknown state'
        });
    }

    return {
        status,
        mpSubscriptionId: extractMpSubscriptionId(subscription),
        activatedAt: deriveActivatedAt(status, subscription)
    };
};

/**
 * GET /api/v1/protected/billing/subscriptions/:localId/status
 *
 * Returns the current status of a locally-created subscription. Used by the
 * front to poll while waiting for the MercadoPago webhook to confirm a
 * paid subscription.
 *
 * Access control:
 * - Requires authentication (handled by the parent billing router).
 * - The requesting user MUST own the subscription — verified by comparing
 *   `subscription.customerId` to the resolved `billingCustomerId` from the
 *   user's session.
 */
export const getSubscriptionStatusRoute = createCRUDRoute({
    method: 'get',
    path: '/{localId}/status',
    summary: 'Get subscription status (polling)',
    description:
        'Returns the current status of a locally-created subscription. Used by the front-end to poll for activation while waiting for the MercadoPago webhook.',
    tags: ['Billing', 'Subscriptions'],
    requestParams: SubscriptionStatusParamsSchema.shape,
    responseSchema: SubscriptionStatusResponseSchema,
    handler: async (c, params) =>
        handleGetSubscriptionStatus(c, { localId: params.localId as string })
});

/**
 * Router that exposes the subscription status polling endpoint.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside the
 * plan-change router. Order does not matter — Hono routes by exact path.
 */
const subscriptionStatusRouter = createRouter();

subscriptionStatusRouter.route('/', getSubscriptionStatusRoute);

export { subscriptionStatusRouter };
