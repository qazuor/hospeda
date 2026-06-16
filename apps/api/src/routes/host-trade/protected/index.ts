/**
 * Protected host-trade routes
 * Requires authentication and HOST_TRADE_VIEW permission
 */
import { createRouter } from '../../../utils/create-app';
import { protectedListHostTradesRoute } from './list';

const protectedRouter = createRouter();

// GET / - List host-trade entries for the authenticated host
protectedRouter.route('/', protectedListHostTradesRoute);

export { protectedRouter as protectedHostTradeRoutes };
