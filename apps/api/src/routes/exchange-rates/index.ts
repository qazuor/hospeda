/**
 * Exchange rate routes index
 * Combines public and protected exchange rate routes
 */
import { createRouter } from '../../utils/create-app.js';
import { protectedExchangeRateRoutes } from './protected/index.js';
import { publicExchangeRateRoutes } from './public/index.js';

const app = createRouter();

// Mount public routes (no authentication required)
app.route('/', publicExchangeRateRoutes);

// Mount protected routes (authentication required)
app.route('/', protectedExchangeRateRoutes);

export { app as exchangeRateRoutes };
