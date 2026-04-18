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
import { webhookSignatureMiddleware } from '../../../middlewares/webhook-signature';
import type { AppOpenAPI } from '../../../types';
import { apiLogger } from '../../../utils/logger';
import { handleDisputeOpened } from './dispute-handler';
import { handleWebhookError, handleWebhookEvent } from './event-handler';
import { handlePaymentCreated, handlePaymentUpdated } from './payment-handler';
import { handleSubscriptionUpdated } from './subscription-handler';
import { getWebhookDependencies } from './utils';

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
                'subscription_preapproval.updated': handleSubscriptionUpdated,
                chargebacks: handleDisputeOpened,
                'payment.dispute': handleDisputeOpened
            },
            onEvent: handleWebhookEvent,
            onError: handleWebhookError
        });

        // Wrap in an outer Hono app so the signature middleware runs BEFORE
        // any route handler registered by createWebhookRouter.
        const securedRouter = new Hono();
        securedRouter.use('*', webhookSignatureMiddleware);
        securedRouter.route('/', webhookRouter as unknown as Hono);

        apiLogger.info('MercadoPago webhook router created successfully');

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
