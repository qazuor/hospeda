/**
 * MercadoPago Webhook Router Factory
 *
 * Creates the Hono router that handles MercadoPago IPN (Instant Payment
 * Notification) webhooks with automatic signature verification, event
 * processing, and idempotency handling.
 *
 * Routes:
 * - POST /api/v1/webhooks/mercadopago - Process MercadoPago IPN notifications
 *
 * @remarks
 * - This is a public endpoint (no authentication required)
 * - Security is handled via webhook signature verification
 * - The MercadoPago adapter automatically verifies the x-signature header
 * - QZPay handles idempotency to prevent duplicate event processing
 * - Returns 200 OK quickly to acknowledge receipt
 *
 * @example
 * MercadoPago will POST to this endpoint with:
 * ```
 * POST /api/v1/webhooks/mercadopago
 * Headers:
 *   x-signature: ts=1234567890,v1=abc123...
 *   x-request-id: unique-request-id
 * Body:
 * {
 *   "id": 12345,
 *   "type": "payment",
 *   "action": "payment.updated",
 *   "data": { "id": "payment-id" }
 * }
 * ```
 *
 * @module routes/webhooks/mercadopago/router
 */

import { createWebhookRouter } from '@qazuor/qzpay-hono';
import { Hono } from 'hono';
import { qzpayLogger } from '../../../lib/qzpay-logger';
import {
    // TODO(SPEC-079): Once rate-limit.ts is extended by SPEC-079 to support
    // per-route webhook overrides natively, replace this usage with the updated
    // factory. For now we use createPerRouteRateLimitMiddleware directly, which
    // is intentionally NOT importing from rate-limit.ts to avoid colliding with
    // SPEC-079 edits in flight.
    createPerRouteRateLimitMiddleware
} from '../../../middlewares/rate-limit';
import type { AppOpenAPI } from '../../../types';
import { apiLogger } from '../../../utils/logger';
import { handleDisputeOpened } from './dispute-handler';
import { handleWebhookError, handleWebhookEvent } from './event-handler';
import { handlePaymentCreated, handlePaymentUpdated } from './payment-handler';
import { handleSubscriptionPreapprovalEvent } from './subscription-handler';
import { handleSubscriptionAuthorizedPayment } from './subscription-payment-handler';
import { getWebhookDependencies } from './utils';

/**
 * Conservative per-route rate limit for the MercadoPago webhook endpoint.
 *
 * Applied ON TOP of the global webhook bucket (100 req/min) as a defence-in-depth
 * layer. MercadoPago sends at most a few dozen events per minute in normal
 * operation; 100 req/min per IP is a reasonable ceiling that blocks flood attacks
 * while never throttling legitimate IPN traffic.
 *
 * SPEC-064 T-049/T-050.
 */
const WEBHOOK_RATE_LIMIT_REQUESTS = 100;
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

/**
 * Discriminator query parameter that identifies a MercadoPago Webhooks v2
 * delivery (as opposed to a legacy IPN "Notificaciones simples" delivery).
 *
 * Background: MercadoPago apps can have BOTH "Notificaciones (IPN)" and
 * "Webhooks (v2)" configured at the same time. When both are enabled MP
 * sends the same logical event through TWO channels — one IPN delivery
 * (`?id=<id>&topic=<type>`) and one v2 delivery (`?data.id=<id>&type=<type>`).
 * The HMAC signing scheme only applies to v2 deliveries; the IPN ones
 * either use a different/legacy scheme or arrive with a stale signature
 * that never matches our manifest, so they show up as warn-level
 * `HMAC mismatch` noise even when the v2 sibling event verifies fine.
 *
 * The fix is operational + a one-line filter: in the MercadoPago dashboard
 * we configure the Webhooks v2 URL with this query parameter appended —
 *
 *   https://<host>/api/v1/webhooks/mercadopago?source_news=webhooks
 *
 * MP then appends its own params with `&`, so the final URL we receive is
 *
 *   .../webhooks/mercadopago?source_news=webhooks&data.id=<id>&type=<type>
 *
 * The IPN URL stays as-is (no marker). The middleware below acknowledges
 * IPN deliveries with 200 (so MP stops retrying) and only forwards v2
 * deliveries — carrying `source_news=webhooks` — to the signature verifier
 * + handler dispatch.
 *
 * Tracked as SPEC-143 Finding #16.
 */
const V2_SOURCE_NEWS_MARKER = 'webhooks';

/**
 * Create MercadoPago webhook router.
 *
 * Instantiates the QZPay webhook router with all configured handlers.
 * Returns null when billing is not configured (e.g. in environments
 * without MercadoPago credentials).
 *
 * @returns Configured Hono router for MercadoPago webhooks, or null when
 *   billing is not configured.
 */
function createMercadoPagoWebhookRouter(): AppOpenAPI | null {
    const dependencies = getWebhookDependencies();

    if (!dependencies) {
        apiLogger.warn('MercadoPago webhook routes not initialized - billing not configured');
        return null;
    }

    try {
        const webhookRouter = createWebhookRouter({
            billing: dependencies.billing,
            paymentAdapter: dependencies.paymentAdapter,
            signatureHeader: 'x-signature',
            // qzpay-hono >=1.4 extracts `x-request-id` automatically and
            // forwards it to the MP adapter's HMAC verifier (which since
            // qzpay-mercadopago >=2.0 includes it in the signed manifest).
            // The custom hospeda webhook-signature middleware was removed
            // because it duplicated this work and ran BEFORE the qzpay
            // verifier — leaving two implementations to keep in sync.
            logger: qzpayLogger,
            handlers: {
                'payment.created': handlePaymentCreated,
                'payment.updated': handlePaymentUpdated,
                // SPEC-126 D3: subscription_preapproval.created is the event MP
                // fires immediately after the user authorizes a recurring
                // charge in the MP-hosted checkout. It transitions the local
                // sub from incomplete/pending_provider to active. The
                // existing processSubscriptionUpdated logic already maps MP
                // `authorized` -> qzpay `active` and applies the status update,
                // so both .created and .updated point at the same handler.
                'subscription_preapproval.created': handleSubscriptionPreapprovalEvent,
                'subscription_preapproval.updated': handleSubscriptionPreapprovalEvent,
                // SPEC-126 D4 / SPEC-141 D4: subscription_authorized_payment events
                // fire when MP schedules / executes a recurring charge against a
                // preapproval. The handler fetches the authorized-payment object
                // via `fetchAuthorizedPaymentDetails` (REST), resolves the local
                // subscription via `mp_subscription_id`, and inserts a
                // `billing_payments` row. Always acks 200 even on upstream
                // failures so MP stops retrying. See
                // `subscription-payment-handler.ts` for the full flow.
                'subscription_authorized_payment.created': handleSubscriptionAuthorizedPayment,
                'subscription_authorized_payment.updated': handleSubscriptionAuthorizedPayment,
                chargebacks: handleDisputeOpened,
                'payment.dispute': handleDisputeOpened
            },
            onEvent: handleWebhookEvent,
            onError: handleWebhookError
        });

        // Wrap in an outer Hono app so the per-route rate limit runs BEFORE
        // any route handler registered by createWebhookRouter. Signature
        // verification is now performed inside the qzpay-hono middleware
        // (which forwards x-signature + x-request-id to the MP adapter),
        // so no extra custom signature middleware is mounted here.
        const securedRouter = new Hono();
        securedRouter.use(
            '*',
            createPerRouteRateLimitMiddleware({
                requests: WEBHOOK_RATE_LIMIT_REQUESTS,
                windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS
            })
        );
        // Drop legacy IPN deliveries — only accept Webhooks v2 (marked by the
        // `?source_news=webhooks` query parameter we configure in the MP
        // dashboard). See `V2_SOURCE_NEWS_MARKER` JSDoc for the full rationale.
        securedRouter.use('*', async (c, next) => {
            const sourceNews = c.req.query('source_news');
            if (sourceNews !== V2_SOURCE_NEWS_MARKER) {
                apiLogger.debug(
                    {
                        provider: 'mercadopago',
                        sourceNews: sourceNews ?? '<missing>',
                        topic: c.req.query('topic') ?? null,
                        type: c.req.query('type') ?? null,
                        dataIdQuery: c.req.query('data.id') ?? null,
                        idQuery: c.req.query('id') ?? null
                    },
                    'Dropping MercadoPago webhook lacking ?source_news=webhooks marker (legacy IPN duplicate of a v2 event)'
                );
                // Ack with 200 so MP stops retrying. The body shape mirrors
                // the qzpay-hono success response for consistency.
                return c.json({ received: true, dropped: 'legacy-ipn-duplicate' }, 200);
            }
            await next();
            return;
        });
        // TYPE-WORKAROUND: webhookRouter from external billing module has its own typed Hono variables; cast aligns it with the local Hono instance signature for mounting.
        securedRouter.route('/', webhookRouter as unknown as Hono);

        apiLogger.info('MercadoPago webhook router created successfully');

        // TYPE-WORKAROUND: securedRouter is a plain Hono but route registration here expects AppOpenAPI; webhook router intentionally bypasses OpenAPI doc generation, so cast widens the type.
        return securedRouter as unknown as AppOpenAPI;
    } catch (error) {
        apiLogger.error(
            'Failed to create MercadoPago webhook router:',
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

/**
 * Factory function that creates MercadoPago webhook routes on demand.
 *
 * Defers execution of `createMercadoPagoWebhookRouter()` until call time,
 * ensuring the database and billing subsystem are fully initialized before
 * any attempt to resolve dependencies.
 *
 * @returns Configured Hono router for MercadoPago webhooks, or `null` when
 *   billing is not configured.
 */
export const createMercadoPagoWebhookRoutes = (): AppOpenAPI | null =>
    createMercadoPagoWebhookRouter();
