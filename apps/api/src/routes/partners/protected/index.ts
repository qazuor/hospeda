/**
 * Protected partner routes (HOS-278 D3).
 *
 * Auth-only, no `PARTNER_*` permission: an approved partner is an ordinary
 * account and ownership of the row is the gate (AC-7).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedGetMyPartnerRoute, protectedUpdateMyPartnerRoute } from './mine';
import { protectedGetMyMentionsRoute } from './mine-mentions';

const protectedRouter = createRouter();

// GET|PATCH /mine - The caller's OWN partner listing.
protectedRouter.route('/', protectedGetMyPartnerRoute);
protectedRouter.route('/', protectedUpdateMyPartnerRoute);
// GET /mine/mentions - The caller's OWN mentions log (HOS-377).
protectedRouter.route('/', protectedGetMyMentionsRoute);

export { protectedRouter as protectedPartnerRoutes };
