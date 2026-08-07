/**
 * Protected host-trade routes
 * Requires authentication and HOST_TRADE_VIEW permission
 */
import { createRouter } from '../../../utils/create-app';
import { protectedListHostTradesRoute } from './list';
import { protectedGetMyHostTradeRoute, protectedUpdateMyHostTradeRoute } from './mine';

const protectedRouter = createRouter();

// GET / - List host-trade entries for the authenticated host
protectedRouter.route('/', protectedListHostTradesRoute);

// GET|PATCH /mine - The caller's OWN listing (HOS-278 AC-7..AC-10).
// Auth-only, no HOST_TRADE_* permission: an approved service provider is an
// ordinary account, and the host-directory read perk is a different thing.
protectedRouter.route('/', protectedGetMyHostTradeRoute);
protectedRouter.route('/', protectedUpdateMyHostTradeRoute);

export { protectedRouter as protectedHostTradeRoutes };
