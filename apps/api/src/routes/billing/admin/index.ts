/**
 * Admin billing routes
 * Routes that require admin-level access for billing operations
 */
import { createRouter } from '../../../utils/create-app';
import { listNotificationLogsRoute } from './notifications';
import { getAdminCustomerUsageSummaryRoute } from './usage';

const app = createRouter();

// GET /usage/:customerId - Get customer usage summary
app.route('/usage', getAdminCustomerUsageSummaryRoute);

// GET /notifications - List notification logs
app.route('/notifications', listNotificationLogsRoute);

export { app as adminBillingRoutes };
