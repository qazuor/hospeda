/**
 * MercadoPago Webhook Module
 *
 * Re-exports all public symbols for backward compatibility and
 * provides the main router factory.
 *
 * @module routes/webhooks/mercadopago
 */

export { handleDisputeOpened } from './dispute-handler';
export {
    cleanupRequestProviderEventId,
    handleWebhookError,
    handleWebhookEvent
} from './event-handler';

export { handlePaymentCreated, handlePaymentUpdated } from './payment-handler';
export { createMercadoPagoWebhookRoutes } from './router';
export { handleSubscriptionUpdated } from './subscription-handler';
export type { AddonMetadata, PaymentInfo } from './types';
export {
    extractAddonFromReference,
    extractAddonMetadata,
    extractPaymentInfo,
    getWebhookDependencies,
    markEventFailedByProviderId,
    markEventProcessedByProviderId,
    markWebhookEventProcessed,
    sanitizeErrorForNotification
} from './utils';
