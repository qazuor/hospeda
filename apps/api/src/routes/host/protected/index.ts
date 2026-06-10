/**
 * Protected host routes barrel export.
 * Aggregates all protected host sub-routes into a single router mounted
 * at `/api/v1/protected/host` via the parent barrel.
 */
import { createRouter } from '../../../utils/create-app';
import { hostDashboardRoute } from './dashboard';

const app = createRouter();

// GET / — Host dashboard aggregation endpoint
app.route('/', hostDashboardRoute);

export { app as protectedHostRoutes };
