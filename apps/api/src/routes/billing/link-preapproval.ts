/**
 * Link-Preapproval Route (HOS-191 Path C, F2)
 *
 * `back_url` return-trip endpoint. Path C's `/start-paid` redirects the browser
 * straight to MercadoPago's hosted share link — no preapproval exists locally
 * at that point. Once the customer authorizes, MercadoPago creates the real
 * preapproval and redirects back to `paymentMethodReturnUrl?preapproval_id=...`.
 * The front-end reads that query param plus the `localSubscriptionId` it
 * stashed in sessionStorage at checkout time, and calls this endpoint to link
 * the two.
 *
 * Front-end contract:
 * - Call on mount of the return page (`?preapproval_id=` present in the URL).
 * - `POST /api/v1/protected/billing/subscriptions/link-preapproval`
 *   `{ preapprovalId, localSubscriptionId }`.
 * - `200` (`outcome: 'linked' | 'already'`) — proceed to the success/polling UI
 *   exactly as before (the existing `GET /subscriptions/:localId/status` polling
 *   endpoint is unaffected — it already polls `mp_subscription_id` becoming set).
 * - `409` — the caller does not own `localSubscriptionId`, or the preapproval
 *   already belongs to a different local subscription. Treat as a hard error.
 * - `422` — the resolution was ambiguous or the local subscription could not be
 *   found. Non-fatal: the `subscription_preapproval` webhook fallback (F3) may
 *   still complete the link server-side shortly after — fall back to polling
 *   `GET /subscriptions/:localId/status` rather than treating this as terminal.
 *
 * If the browser never returns (tab closed, network drop), the webhook fallback
 * (F3, `routes/webhooks/mercadopago/subscription-logic.ts`) performs the same
 * link server-to-server — this endpoint is a fast path, not the only path.
 *
 * @module routes/billing/link-preapproval
 */

import { createMercadoPagoAdapter } from '@repo/billing';
import { LinkPreapprovalRequestSchema, LinkPreapprovalResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { qzpayLogger } from '../../lib/qzpay-logger';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import type { LinkPreapprovalOutcome } from '../../services/billing/link-preapproval.service';
import { linkPreapprovalToLocalSub } from '../../services/billing/link-preapproval.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

/**
 * Map a {@link LinkPreapprovalOutcome} to the HTTP response the route returns.
 * `linked`/`already` are handled by the caller (200 with the outcome body);
 * every other outcome maps to a thrown `HTTPException`.
 */
function mapOutcomeToHttpException(
    outcome: Exclude<LinkPreapprovalOutcome, 'linked' | 'already'>
): HTTPException {
    switch (outcome) {
        case 'idor':
            return new HTTPException(409, {
                message: 'You do not own this pending subscription checkout'
            });
        case 'not_found':
            return new HTTPException(422, {
                message: 'No matching pending subscription checkout found for this preapproval'
            });
        case 'reconcile_assisted':
            return new HTTPException(422, {
                message:
                    'Could not unambiguously link this preapproval — it will be reconciled automatically shortly'
            });
        default: {
            const exhaustive: never = outcome;
            void exhaustive;
            return new HTTPException(500, { message: 'Unexpected linking outcome' });
        }
    }
}

/**
 * Handler for the link-preapproval endpoint.
 *
 * @param c - Hono context.
 * @param body - Validated request body.
 * @returns `{ outcome, localSubscriptionId }` on `linked`/`already`.
 * @throws HTTPException 503 if billing is not configured.
 * @throws HTTPException 400 if the caller has no billing customer on session.
 * @throws HTTPException 409/422 per {@link mapOutcomeToHttpException}.
 */
export const handleLinkPreapproval = async (
    c: Context,
    body: { preapprovalId: string; localSubscriptionId: string }
): Promise<{ outcome: 'linked' | 'already'; localSubscriptionId: string }> => {
    const billingEnabled = c.get('billingEnabled');
    if (!billingEnabled) {
        throw new HTTPException(503, { message: 'Billing service is not configured' });
    }

    const actor = getActorFromContext(c);
    const billing = getQZPayBilling();
    if (!billing) {
        throw new HTTPException(503, { message: 'Billing service is not available' });
    }

    const billingCustomerId = c.get('billingCustomerId');
    if (!billingCustomerId) {
        throw new HTTPException(400, { message: 'No billing account found' });
    }

    // Mirrors the webhook handler's own adapter construction (trial.ts, payment
    // handlers): qzpay-core's `getPaymentAdapter()` returns the generic adapter
    // interface, and linking needs the MercadoPago-typed `subscriptions.retrieve/update`.
    const adapter = createMercadoPagoAdapter({ logger: qzpayLogger });

    try {
        const live = await adapter.subscriptions.retrieve(body.preapprovalId);

        const result = await linkPreapprovalToLocalSub({
            preapprovalId: body.preapprovalId,
            externalReference: live.externalReference ?? null,
            payerEmail: live.payerEmail ?? null,
            expectedLocalSubscriptionId: body.localSubscriptionId,
            expectedCustomerId: billingCustomerId,
            billing,
            adapter
        });

        if (result.outcome === 'linked' || result.outcome === 'already') {
            apiLogger.info(
                {
                    userId: actor.id,
                    customerId: billingCustomerId,
                    preapprovalId: body.preapprovalId,
                    localSubscriptionId: result.localSubscriptionId,
                    outcome: result.outcome
                },
                'HOS-191 link-preapproval: back_url linking resolved'
            );
            // biome-ignore lint/style/noNonNullAssertion: localSubscriptionId is always set for 'linked'/'already'
            return { outcome: result.outcome, localSubscriptionId: result.localSubscriptionId! };
        }

        throw mapOutcomeToHttpException(result.outcome);
    } catch (error) {
        if (error instanceof HTTPException) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            {
                userId: actor.id,
                customerId: billingCustomerId,
                preapprovalId: body.preapprovalId,
                localSubscriptionId: body.localSubscriptionId,
                error: errorMessage
            },
            'HOS-191 link-preapproval: unexpected error'
        );
        throw new HTTPException(500, { message: 'Failed to link subscription. Please try again.' });
    }
};

/**
 * POST /api/v1/protected/billing/subscriptions/link-preapproval
 *
 * See module docstring for the full front-end contract.
 */
export const linkPreapprovalRoute = createCRUDRoute({
    method: 'post',
    path: '/link-preapproval',
    summary: 'Link a MercadoPago preapproval to its pending local subscription',
    description:
        'Called by the back_url return page after MercadoPago authorizes the share-link checkout. Links the real preapproval id to the pending_provider local subscription created at checkout time.',
    tags: ['Billing', 'Subscriptions'],
    requestBody: LinkPreapprovalRequestSchema,
    responseSchema: LinkPreapprovalResponseSchema,
    successStatusCode: 200,
    handler: async (c, _params, body) =>
        handleLinkPreapproval(c, {
            preapprovalId: body.preapprovalId as string,
            localSubscriptionId: body.localSubscriptionId as string
        })
});

/**
 * Router that exposes the link-preapproval endpoint.
 *
 * Mounted under `/api/v1/protected/billing/subscriptions` alongside
 * `startPaidRouter`, `planChangeRouter`, and `subscriptionStatusRouter`. Hono
 * routes by exact path so the four siblings coexist without conflict.
 */
const linkPreapprovalRouter = createRouter();
linkPreapprovalRouter.route('/', linkPreapprovalRoute);

export { linkPreapprovalRouter };
