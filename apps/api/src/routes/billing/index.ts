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
 * - Usage tracking (custom routes)
 *
 * Admin-only routes (metrics, settings, notifications) are mounted
 * separately under /api/v1/admin/billing via billing/admin/index.ts.
 *
 * All routes are mounted under /api/v1/protected/billing
 *
 * @module routes/billing
 */

import { createBillingRoutes } from '@qazuor/qzpay-hono';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling, requireBilling } from '../../middlewares/billing';
import { billingAdminGuardMiddleware } from '../../middlewares/billing-admin-guard.middleware';
import { billingOwnershipMiddleware } from '../../middlewares/billing-ownership.middleware';
import { pastDueGraceMiddleware } from '../../middlewares/past-due-grace.middleware';
import { sentryBillingMiddleware } from '../../middlewares/sentry';
import type { AppOpenAPI } from '../../types';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { addonsRouter } from './addons';
import { planChangeRouter } from './plan-change';
import { userPromoCodesRouter } from './promo-codes';
import { startPaidRouter } from './start-paid';
import { subscriptionPauseRouter } from './subscription-pause';
import { subscriptionStatusRouter } from './subscription-status';
import { trialRouter } from './trial';
import { usageRouter } from './usage';

/**
 * Authentication middleware for billing routes.
 * Compatible with QZPay's authMiddleware requirement.
 *
 * Accepts either `user` (set by better-auth session middleware in production)
 * or `actor` (set by actorMiddleware, which is the codebase-wide auth abstraction
 * and is also populated in test mode via HOSPEDA_ALLOW_MOCK_ACTOR). The two are
 * always set together in production; the dual check exists so test setups that
 * skip the session layer still pass through.
 */
const billingAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const user = c.get('user');
    const actor = c.get('actor');

    if (!user?.id && !actor?.id) {
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

        // TYPE-WORKAROUND: createBillingRoutes returns a generic Hono app whose typed variables differ from our AppOpenAPI binding; cast aligns external module's Hono instance with our project-wide OpenAPI app type.
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

    // Grace period enforcement: blocks past_due users with expired grace from billing operations.
    // Recovery paths (reactivation, checkout) are exempt - see GRACE_EXEMPT_PATH_SUFFIXES
    // in past-due-grace.middleware.ts.
    router.use('*', pastDueGraceMiddleware());

    // Mount QZPay pre-built billing routes with ownership verification.
    // The ownership middleware ensures users can only access their own billing
    // resources (customers, subscriptions, invoices, payments, entitlements).
    // Applied here (not globally) because custom routes already enforce ownership
    // through c.get('billingCustomerId') and admin routes are on separate paths.
    const qzpayRoutes = createQZPayBillingRouter();
    const qzpayWrapper = createRouter();
    qzpayWrapper.use('*', billingAdminGuardMiddleware());
    qzpayWrapper.use('*', billingOwnershipMiddleware());
    qzpayWrapper.route('/', qzpayRoutes);
    router.route('/', qzpayWrapper);

    // Mount user-facing promo code routes (validate + apply).
    // Admin promo code CRUD is mounted separately under /admin/billing/promo-codes.
    router.route('/promo-codes', userPromoCodesRouter);

    // Mount custom add-on routes
    router.route('/addons', addonsRouter);

    // Mount custom trial routes
    router.route('/trial', trialRouter);

    // Mount custom plan change routes
    router.route('/subscriptions', planChangeRouter);

    // Mount custom subscription status polling routes (SPEC-126 D2).
    // Sits on the same `/subscriptions` prefix as plan-change because both
    // operate on local subscription rows; Hono routes by exact path so there
    // is no conflict between the two routers.
    router.route('/subscriptions', subscriptionStatusRouter);

    // Mount custom start-paid subscription route (SPEC-126 D1).
    router.route('/subscriptions', startPaidRouter);

    // Mount self-serve pause/resume routes (SPEC-143 #29) at the billing root,
    // NOT under `/subscriptions`. The routes are `/me/subscription-pause` and
    // `/me/subscription-resume`; keeping them off the `/subscriptions` namespace
    // avoids colliding with qzpay's built-in `POST /subscriptions/:id/pause`
    // (which would match `:id='me'`) and the `/subscriptions`-scoped admin-guard
    // + ownership middlewares.
    router.route('/', subscriptionPauseRouter);

    // Mount custom usage tracking routes
    router.route('/usage', usageRouter);

    apiLogger.debug(
        'Billing routes configured with custom promo code, add-on, trial, plan-change, subscription status, start-paid, and usage routes'
    );

    return router;
}
