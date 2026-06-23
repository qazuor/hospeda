/**
 * Admin billing routes
 *
 * Routes that require admin-level access for billing operations.
 * All routes are mounted under /api/v1/admin/billing.
 * Rate limited to 50 requests per minute per IP.
 *
 * Layout:
 * - Hospeda-specific custom routes are mounted FIRST so they win on path
 *   collisions: metrics, settings, notifications, customer-addons,
 *   subscription-events, custom addons / plans catalogs and customer usage.
 * - The qzpay-hono `createAdminRoutes` factory is mounted LAST. It provides
 *   the generic CRUD + write operations (subscriptions list/get/cancel/
 *   change-plan/extend-trial, payments list/get/refund, invoices list/get/
 *   pay/void, entitlements + limits management, promo-codes catalog,
 *   dashboard). All write paths (`/cancel`, `/refund`, `/pay`, etc.) invoke
 *   the Hospeda lifecycle hooks defined in `./qzpay-admin-hooks.ts`.
 *
 * The custom `subscription-cancel.ts` route that used to live here was
 * removed in this change — its Phase 1 + Phase 2 lifecycle is now expressed
 * as onBefore/onAfter hooks consumed by qzpay-hono v1.3+.
 */

import { createAdminRoutes } from '@qazuor/qzpay-hono';
import { PermissionEnum } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import { createPerRouteRateLimitMiddleware } from '../../../middlewares/rate-limit';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { notificationsRouter } from '../notifications';
import { adminPromoCodesRouter } from '../promo-codes';
import { settingsRouter } from '../settings';
import { adminAddonsRouter } from './addons';
import {
    activateCustomerAddonRoute,
    expireCustomerAddonRoute,
    listCustomerAddonsRoute
} from './customer-addons';
import { adminCustomerEntitlementsRouter } from './customer-entitlements';
import { adminMetricsRouter } from './metrics';
import { listNotificationLogsRoute } from './notifications';
import { adminPlansRouter } from './plans';
import { adminBillingHooks } from './qzpay-admin-hooks';
import { subscriptionEventsRoute } from './subscription-events';
import { adminSubscriptionTrialExtensionRouter } from './subscription-trial-extension';
import { getAdminCustomerUsageSummaryRoute } from './usage';

/**
 * Auth middleware applied to every qzpay-hono admin route. Enforces a base
 * `BILLING_READ_ALL` permission for any request, plus stricter permissions
 * on write paths:
 *  - subscriptions {cancel,force-cancel,pause,resume,change-plan,extend-trial}: MANAGE_SUBSCRIPTIONS
 *  - payments/invoices write paths + entitlements/limits manage: BILLING_MANAGE
 *
 * Authentication itself is established upstream by the global auth chain;
 * this middleware only enforces *permission*. We throw HTTPException so the
 * existing error mapper turns it into the project's standard 403 envelope.
 */
const adminBillingAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const actor = getActorFromContext(c);

    if (!actor?.id) {
        throw new HTTPException(401, { message: 'Authentication required' });
    }

    const permissions: readonly string[] = actor.permissions ?? [];

    if (!permissions.includes(PermissionEnum.BILLING_READ_ALL)) {
        throw new HTTPException(403, { message: 'Admin billing access required' });
    }

    const method = c.req.method.toUpperCase();
    if (method !== 'GET') {
        const path = c.req.path;

        const isSubscriptionWrite =
            path.includes('/subscriptions/') &&
            (path.endsWith('/cancel') ||
                path.endsWith('/force-cancel') ||
                path.endsWith('/pause') ||
                path.endsWith('/resume') ||
                path.endsWith('/change-plan') ||
                path.endsWith('/extend-trial'));

        if (isSubscriptionWrite && !permissions.includes(PermissionEnum.MANAGE_SUBSCRIPTIONS)) {
            throw new HTTPException(403, {
                message: 'Subscription management permission required'
            });
        }

        const isMoneyMove =
            path.endsWith('/refund') ||
            path.endsWith('/force-refund') ||
            path.endsWith('/pay') ||
            path.endsWith('/mark-paid') ||
            path.endsWith('/void') ||
            path.includes('/entitlements') ||
            path.includes('/limits/');

        if (isMoneyMove && !permissions.includes(PermissionEnum.BILLING_MANAGE)) {
            throw new HTTPException(403, {
                message: 'Billing management permission required'
            });
        }
    }

    await next();
};

const app = createRouter();

// Apply rate limit of 50 req/min per IP for all admin billing routes.
app.use('*', createPerRouteRateLimitMiddleware({ requests: 50, windowMs: 60_000 }));

// ── Hospeda-specific custom routes (mounted FIRST so they win on path collisions) ──

// GET /usage/:customerId - Get customer usage summary
app.route('/usage', getAdminCustomerUsageSummaryRoute);

// GET/PATCH /settings, POST /settings/reset - Billing configuration (admin only)
app.route('/settings', settingsRouter);

// GET /notifications - List notification logs
app.route('/notifications', listNotificationLogsRoute);

// POST /notifications/cleanup - Retention policy cleanup (admin only)
app.route('/notifications', notificationsRouter);

// GET /customer-addons - List purchased add-ons across all customers
app.route('/customer-addons', listCustomerAddonsRoute);

// POST /customer-addons/:id/expire - Expire an active add-on purchase
app.route('/customer-addons', expireCustomerAddonRoute);

// POST /customer-addons/:id/activate - Activate an expired/canceled add-on purchase
app.route('/customer-addons', activateCustomerAddonRoute);

// GET /metrics, /metrics/activity, /metrics/system-usage, /metrics/approaching-limits
app.route('/metrics', adminMetricsRouter);

// GET /subscriptions/:id/events - List lifecycle events for a subscription
app.route('/subscriptions', subscriptionEventsRoute);

// POST /subscriptions/:subscriptionId/apply-trial-extension - Apply a trial_extension promo to a subscription (admin, BILLING_PROMO_CODE_MANAGE)
app.route('/subscriptions', adminSubscriptionTrialExtensionRouter);

// GET /addons, /addons/:slug - Hospeda add-on catalog (admin only)
app.route('/addons', adminAddonsRouter);

// POST /customer-entitlements/grant - Grant one-off entitlement to a customer
// DELETE /customer-entitlements/revoke - Revoke a customer entitlement
app.route('/customer-entitlements', adminCustomerEntitlementsRouter);

// GET /plans, /plans/:id - Hospeda plan view (admin only)
app.route('/plans', adminPlansRouter);

// GET/POST/PUT/DELETE /promo-codes - Hospeda promo code catalog (admin only).
// User-self verbs (validate, apply) stay under /protected/billing/promo-codes.
// Mounted BEFORE the qzpay admin tier so this Hospeda-specific implementation
// wins over qzpay-hono's read-only `/admin/promo-codes` GET (which would
// otherwise shadow our richer list with audit log + livemode handling).
app.route('/promo-codes', adminPromoCodesRouter);

// ── QZPay admin tier (mounted LAST; covers everything custom routes don't) ──
//
// IMPORTANT: This mount is DEFERRED via `mountQZPayAdminTier()` instead of
// running at module load. Why: this module is statically imported by
// `routes/index.ts` which is statically imported by `app.ts` which is
// statically imported by `index.ts`. ESM hoists static imports BEFORE
// `index.ts:startServer()` runs `await initializeDatabase()`, so calling
// `getQZPayBilling()` at module-load time hits "Database not initialized"
// and silently skips the mount — leaving every qzpay admin endpoint as 404
// in production. Caller (index.ts) must invoke `mountQZPayAdminTier()` AFTER
// the DB is ready.

let qzpayAdminMounted = false;

/**
 * Mounts the qzpay-hono admin tier (subscriptions, payments, invoices, etc.)
 * under `/api/v1/admin/billing/*`. Idempotent: the mount only runs once even
 * if called multiple times.
 *
 * Must be invoked AFTER `initializeDatabase()` so `getQZPayBilling()` can
 * resolve the storage adapter against a live `getDb()`.
 */
export function mountQZPayAdminTier(): void {
    if (qzpayAdminMounted) {
        return;
    }
    qzpayAdminMounted = true;

    const billing = getQZPayBilling();
    if (!billing) {
        apiLogger.warn(
            'QZPay admin tier not mounted under /admin/billing: billing service unavailable'
        );
        return;
    }

    const qzpayAdmin = createAdminRoutes({
        billing,
        prefix: '',
        authMiddleware: adminBillingAuthMiddleware,
        hooks: adminBillingHooks
    });
    app.route('/', qzpayAdmin);
    apiLogger.info('QZPay admin tier mounted under /api/v1/admin/billing');
}

export { app as adminBillingRoutes };
