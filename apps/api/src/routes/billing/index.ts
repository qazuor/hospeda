/**
 * QZPay Billing Routes
 *
 * Pre-built billing routes from @qazuor/qzpay-hono
 * Provides complete billing functionality including:
 * - Customer management
 * - Subscription lifecycle
 * - Plan and pricing configuration
 * - Invoice generation and payment
 * - Entitlement and usage tracking
 * - Checkout flow
 * - Webhook handling
 * - Promo code management (custom routes)
 * - Add-on purchase flow (custom routes)
 * - Trial management (custom routes)
 * - Billing metrics and analytics (custom routes)
 * - Billing settings configuration (custom routes)
 * - Usage tracking (custom routes)
 *
 * All routes are mounted under /api/v1/billing
 *
 * @module routes/billing
 */

import { createBillingRoutes } from '@qazuor/qzpay-hono';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling, requireBilling } from '../../middlewares/billing';
import { sentryBillingMiddleware } from '../../middlewares/sentry';
import type { AppOpenAPI } from '../../types';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import addonsRouter from './addons';
import metricsRouter from './metrics';
import notificationsRouter from './notifications';
import planChangeRouter from './plan-change';
import promoCodesRouter from './promo-codes';
import settingsRouter from './settings';
import trialRouter from './trial';
import usageRouter from './usage';

/**
 * Authentication middleware for billing routes.
 * Compatible with QZPay's authMiddleware requirement.
 */
const billingAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const user = c.get('user');

    if (!user?.id) {
        throw new HTTPException(401, {
            message: 'Authentication required for billing operations'
        });
    }

    await next();
};

/**
 * Create the inner QZPay billing router with pre-built handlers.
 *
 * Routes provided:
 * - GET    /customers          - List customers
 * - POST   /customers          - Create customer
 * - GET    /customers/:id      - Get customer
 * - PUT    /customers/:id      - Update customer
 * - DELETE /customers/:id      - Delete customer
 *
 * - GET    /subscriptions      - List subscriptions
 * - POST   /subscriptions      - Create subscription
 * - GET    /subscriptions/:id  - Get subscription
 * - PUT    /subscriptions/:id  - Update subscription
 * - DELETE /subscriptions/:id  - Cancel subscription
 *
 * - GET    /plans              - List plans
 * - POST   /plans              - Create plan
 * - GET    /plans/:id          - Get plan
 * - PUT    /plans/:id          - Update plan
 * - DELETE /plans/:id          - Delete plan
 *
 * - GET    /invoices           - List invoices
 * - POST   /invoices           - Create invoice
 * - GET    /invoices/:id       - Get invoice
 * - POST   /invoices/:id/pay   - Pay invoice
 * - POST   /invoices/:id/void  - Void invoice
 *
 * - GET    /payments           - List payments
 * - POST   /payments           - Process payment
 * - GET    /payments/:id       - Get payment
 * - POST   /payments/:id/refund - Refund payment
 *
 * - GET    /entitlements       - List entitlements
 * - POST   /entitlements       - Grant entitlement
 * - GET    /entitlements/:id   - Get entitlement
 * - DELETE /entitlements/:id   - Revoke entitlement
 *
 * - POST   /checkout           - Create checkout session
 * - GET    /checkout/:id       - Get checkout session
 *
 * - POST   /webhooks           - Handle payment webhooks
 *
 * @returns Hono router with QZPay billing routes
 */
function createQZPayBillingRouter(): AppOpenAPI {
    const billing = getQZPayBilling();

    if (!billing) {
        // Billing not configured - return empty router.
        // The requireBilling middleware will handle the 503 response.
        apiLogger.warn('Billing routes created but billing is not configured');
        return createRouter();
    }

    try {
        const routes = createBillingRoutes({
            billing,
            prefix: '', // No prefix - added when mounting
            authMiddleware: billingAuthMiddleware
        });

        apiLogger.info('QZPay billing routes created successfully');

        return routes as unknown as AppOpenAPI;
    } catch (error) {
        apiLogger.error(
            'Failed to create billing routes:',
            error instanceof Error ? error.message : String(error)
        );

        // Return empty router on error
        return createRouter();
    }
}

/**
 * Factory function that assembles and returns the full billing router.
 *
 * Defers execution until call time so that the database and billing subsystem
 * are fully initialized before any attempt to resolve dependencies via
 * `getQZPayBilling()` / `getDb()`.
 *
 * All routes require:
 * - Authentication (via billingAuthMiddleware from QZPay config)
 * - Billing to be enabled (via requireBilling middleware)
 * - Sentry billing context (via sentryBillingMiddleware)
 *
 * @returns Configured Hono router with all billing sub-routes mounted.
 */
export function createBillingRoutesHandler(): AppOpenAPI {
    const router = createRouter();

    // Apply billing requirement middleware
    router.use('*', requireBilling);

    // Apply Sentry billing context middleware
    router.use('*', sentryBillingMiddleware());

    // Mount QZPay pre-built billing routes
    const qzpayRoutes = createQZPayBillingRouter();
    router.route('/', qzpayRoutes);

    // Mount custom promo code routes
    router.route('/promo-codes', promoCodesRouter);

    // Mount custom add-on routes
    router.route('/addons', addonsRouter);

    // Mount custom trial routes
    router.route('/trial', trialRouter);

    // Mount custom plan change routes
    router.route('/subscriptions', planChangeRouter);

    // Mount custom metrics routes
    router.route('/metrics', metricsRouter);

    // Mount custom settings routes
    router.route('/settings', settingsRouter);

    // Mount custom usage tracking routes
    router.route('/usage', usageRouter);

    // Mount custom notification management routes
    router.route('/notifications', notificationsRouter);

    apiLogger.debug(
        'Billing routes configured with custom promo code, add-on, trial, plan-change, metrics, settings, usage, and notification routes'
    );

    return router;
}
