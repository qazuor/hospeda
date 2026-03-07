/**
 * Protected exchange rate routes
 * Requires authentication and appropriate permissions.
 * Only read-only operations are exposed here.
 * Admin operations (create, delete, fetch-now, update-config) are exclusively
 * in the admin tier at /api/v1/admin/exchange-rates.
 */
import { createRouter } from '../../../utils/create-app.js';
import { getConfigRoute } from './get-config.js';
import { exchangeRateHistoryRoute } from './history.js';

const router = createRouter();

// Register protected read-only routes
router.route('/', getConfigRoute);
router.route('/', exchangeRateHistoryRoute);

export { router as protectedExchangeRateRoutes };
