/**
 * Protected partner routes (HOS-278 D3).
 *
 * Auth-only, no `PARTNER_*` permission: an approved partner is an ordinary
 * account and ownership of the row is the gate (AC-7).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedGetMyPartnerRoute, protectedUpdateMyPartnerRoute } from './mine';
import { protectedGetMyMentionsRoute } from './mine-mentions';
import { protectedGetMyStatsRoute } from './mine-stats';

const protectedRouter = createRouter();

// GET|PATCH /mine - The caller's OWN partner listing.
protectedRouter.route('/', protectedGetMyPartnerRoute);
protectedRouter.route('/', protectedUpdateMyPartnerRoute);
// GET /mine/mentions - The caller's OWN mentions log (HOS-377).
protectedRouter.route('/', protectedGetMyMentionsRoute);
// GET /mine/stats - The caller's OWN in-platform statistics (HOS-1063).
// A SIBLING of the mentions log, never a section inside it: the log answers
// "what did you do for me?" and this answers "how did it perform?", and
// blurring them is how a record of facts starts implying a measurement
// (PartnerMentionsSection.astro:16-21, spec AC-8).
protectedRouter.route('/', protectedGetMyStatsRoute);

export { protectedRouter as protectedPartnerRoutes };
