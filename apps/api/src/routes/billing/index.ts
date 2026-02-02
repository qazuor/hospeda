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
import type { AppOpenAPI } from '../../types';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import addonsRouter from './addons';
import metricsRouter from './metrics';
import notificationsRouter from './notifications';
import promoCodesRouter from './promo-codes';
import settingsRouter from './settings';
import trialRouter from './trial';
import usageRouter from './usage';

/**
 * Authentication middleware for billing routes
 * Compatible with QZPay's authMiddleware requirement
 */
const billingAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const auth = c.get('auth');

    if (!auth?.userId) {
        throw new HTTPException(401, {
            message: 'Authentication required for billing operations'
        });
    }

    await next();
};

/**
 * Create billing routes with QZPay pre-built handlers
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
 * @returns Hono router with all billing routes
 */
function createBillingRouter(): AppOpenAPI {
    const billing = getQZPayBilling();

    if (!billing) {
        // Billing not configured - return empty router
        // The requireBilling middleware will handle the error
        apiLogger.warn('Billing routes created but billing is not configured');
        return createRouter();
    }

    try {
        // Create QZPay billing routes with authentication
        const billingRoutes = createBillingRoutes({
            billing,
            prefix: '', // No prefix - will be added when mounting
            authMiddleware: billingAuthMiddleware // Require authentication for all billing routes
        });

        apiLogger.info('✅ Billing routes created successfully');

        return billingRoutes as unknown as AppOpenAPI;
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
 * Billing routes router
 *
 * All routes require:
 * - Authentication (via billingAuthMiddleware from QZPay config)
 * - Billing to be enabled (via requireBilling middleware)
 */
export const billingRoutes = createRouter();

// Apply billing requirement middleware
billingRoutes.use('*', requireBilling);

// Mount QZPay billing routes
const qzpayRoutes = createBillingRouter();
billingRoutes.route('/', qzpayRoutes);

// Mount custom promo code routes
billingRoutes.route('/promo-codes', promoCodesRouter);

// Mount custom add-on routes
billingRoutes.route('/addons', addonsRouter);

// Mount custom trial routes
billingRoutes.route('/trial', trialRouter);

// Mount custom metrics routes
billingRoutes.route('/metrics', metricsRouter);

// Mount custom settings routes
billingRoutes.route('/settings', settingsRouter);

// Mount custom usage tracking routes
billingRoutes.route('/usage', usageRouter);

// Mount custom notification management routes
billingRoutes.route('/notifications', notificationsRouter);

apiLogger.debug(
    'Billing routes configured with custom promo code, add-on, trial, metrics, settings, usage, and notification routes'
);
