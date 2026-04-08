/**
 * Public stats routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetPlatformStatsRoute } from './get-platform-stats';

const app = createRouter();

// GET / - Get platform statistics
app.route('/', publicGetPlatformStatsRoute);

export { app as publicStatsRoutes };
