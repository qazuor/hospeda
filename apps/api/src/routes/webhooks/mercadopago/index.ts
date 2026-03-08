/**
 * MercadoPago Webhook Module
 *
 * Re-exports all public symbols for backward compatibility and
 * provides the main router factory.
 *
 * @module routes/webhooks/mercadopago
 */

export type { PaymentInfo, AddonMetadata } from './types';

export {
    sanitizeErrorForNotification,
    markWebhookEventProcessed,
    markEventProcessedByProviderId,
    markEventFailedByProviderId,
    getWebhookDependencies,
    extractAddonMetadata,
    extractAddonFromReference,
    extractPaymentInfo
} from './utils';

export { handlePaymentCreated, handlePaymentUpdated } from './payment-handler';
export { handleSubscriptionUpdated } from './subscription-handler';
export { handleDisputeOpened } from './dispute-handler';
export { handleWebhookEvent, handleWebhookError } from './event-handler';
export { createMercadoPagoWebhookRoutes } from './router';
