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

export { brevoWebhookRoutes } from './brevo';
export { webhookHealthRoutes } from './health';
export { createMercadoPagoWebhookRoutes } from './mercadopago';
