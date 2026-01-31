/**
 * Webhook Routes
 *
 * Aggregates and exports all webhook route handlers.
 *
 * Webhooks are public endpoints that receive notifications from external services.
 * They use signature verification for security instead of authentication.
 *
 * Health monitoring endpoint provides webhook system metrics and is protected
 * by CRON_SECRET authentication.
 *
 * @module routes/webhooks
 */

export { mercadoPagoWebhookRoutes } from './mercadopago';
export { webhookHealthRoutes } from './health';
