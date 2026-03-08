/**
 * Admin billing routes
 * Routes that require admin-level access for billing operations
 */
import { createRouter } from '../../../utils/create-app';
import { listCustomerAddonsRoute } from './customer-addons';
import { adminMetricsRouter } from './metrics';
import { listNotificationLogsRoute } from './notifications';
import { subscriptionEventsRoute } from './subscription-events';
import { getAdminCustomerUsageSummaryRoute } from './usage';

const app = createRouter();

// GET /usage/:customerId - Get customer usage summary
app.route('/usage', getAdminCustomerUsageSummaryRoute);

// GET /notifications - List notification logs
app.route('/notifications', listNotificationLogsRoute);

// GET /customer-addons - List purchased add-ons across all customers
app.route('/customer-addons', listCustomerAddonsRoute);

// GET /metrics, /metrics/activity, /metrics/system-usage, /metrics/approaching-limits
app.route('/metrics', adminMetricsRouter);

// GET /subscriptions/:id/events - List lifecycle events for a subscription
app.route('/subscriptions', subscriptionEventsRoute);

export { app as adminBillingRoutes };
