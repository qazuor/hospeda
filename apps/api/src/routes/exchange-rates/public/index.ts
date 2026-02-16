/**
 * Public exchange rate routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app.js';
import { publicConvertExchangeRateRoute } from './convert.js';
import { publicListExchangeRatesRoute } from './list.js';

const router = createRouter();

// Register public routes
router.route('/', publicListExchangeRatesRoute);
router.route('/', publicConvertExchangeRateRoute);

export { router as publicExchangeRateRoutes };
