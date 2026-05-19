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
import {
    // TODO(SPEC-079): Once rate-limit.ts is extended by SPEC-079 to support
    // per-route webhook overrides natively, replace this usage with the updated
    // factory. For now we use createPerRouteRateLimitMiddleware directly, which
    // is intentionally NOT importing from rate-limit.ts to avoid colliding with
    // SPEC-079 edits in flight.
    createPerRouteRateLimitMiddleware
} from '../../../middlewares/rate-limit';
import { webhookSignatureMiddleware } from '../../../middlewares/webhook-signature';
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

        // Wrap in an outer Hono app so middleware runs BEFORE any route
        // handler registered by createWebhookRouter. Order matters:
        //   1. Per-route rate limit (SPEC-064 T-049/T-050) — blocks floods early
        //   2. Signature verification (SPEC-064 T-036/T-037/T-038) — validates HMAC
        const securedRouter = new Hono();
        securedRouter.use(
            '*',
            createPerRouteRateLimitMiddleware({
                requests: WEBHOOK_RATE_LIMIT_REQUESTS,
                windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS
            })
        );
        securedRouter.use('*', webhookSignatureMiddleware);
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
