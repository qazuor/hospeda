/**
 * Admin billing routes
 * Routes that require admin-level access for billing operations.
 *
 * All routes are mounted under /api/v1/admin/billing.
 */
import { createRouter } from '../../../utils/create-app';
import { notificationsRouter } from '../notifications';
import { settingsRouter } from '../settings';
import { adminAddonsRouter } from './addons';
import {
    activateCustomerAddonRoute,
    expireCustomerAddonRoute,
    listCustomerAddonsRoute
} from './customer-addons';
import { adminMetricsRouter } from './metrics';
import { listNotificationLogsRoute } from './notifications';
import { adminPlansRouter } from './plans';
import { subscriptionCancelRoute } from './subscription-cancel';
import { subscriptionEventsRoute } from './subscription-events';
import { getAdminCustomerUsageSummaryRoute } from './usage';

const app = createRouter();

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

// POST /subscriptions/:id/cancel - Cancel a subscription (admin only)
app.route('/subscriptions', subscriptionCancelRoute);

// GET /addons, /addons/:slug - Add-on definitions (admin only)
app.route('/addons', adminAddonsRouter);

// GET /plans, /plans/:id - Plan definitions (admin only)
app.route('/plans', adminPlansRouter);

export { app as adminBillingRoutes };
