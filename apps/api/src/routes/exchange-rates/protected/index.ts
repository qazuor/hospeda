/**
 * Protected exchange rate routes
 * Requires authentication and appropriate permissions
 */
import { createRouter } from '../../../utils/create-app.js';
import { protectedCreateExchangeRateRoute } from './create.js';
import { deleteExchangeRateRoute } from './delete.js';
import { fetchNowExchangeRateRoute } from './fetch-now.js';
import { getConfigRoute } from './get-config.js';
import { exchangeRateHistoryRoute } from './history.js';
import { updateConfigRoute } from './update-config.js';

const router = createRouter();

// Register protected routes
router.route('/', protectedCreateExchangeRateRoute);
router.route('/', deleteExchangeRateRoute);
router.route('/', fetchNowExchangeRateRoute);
router.route('/', getConfigRoute);
router.route('/', exchangeRateHistoryRoute);
router.route('/', updateConfigRoute);

export { router as protectedExchangeRateRoutes };
