/**
 * Protected view-stats routes (authentication required).
 *
 * All routes in this module require a valid Better Auth session and the
 * appropriate permission. The actor is resolved from context by
 * `getActorFromContext`; no caller-supplied owner IDs are accepted.
 *
 * Routes registered here:
 *   GET /accommodations/me   — host's own accommodation view stats (T-009)
 *   GET /posts               — editor view stats for a batch of POSTs (T-010)
 *   GET /events              — editor view stats for a batch of EVENTs (T-010)
 *
 * @module routes/views/protected
 * @see SPEC-159 T-009, T-010
 */

import { createRouter } from '../../../utils/create-app';
import { hostAccommodationViewStatsRoute } from './accommodations-me';
import { eventViewStatsRoute } from './events';
import { postViewStatsRoute } from './posts';

const app = createRouter();

// T-009: host's own accommodation view stats
// Path: GET /accommodations/me — declared as /accommodations/me in the route file
app.route('/', hostAccommodationViewStatsRoute);

// T-010: editor view stats for POSTs
// Path: GET /posts
app.route('/', postViewStatsRoute);

// T-010: editor view stats for EVENTs
// Path: GET /events
app.route('/', eventViewStatsRoute);

export { app as protectedViewsRoutes };
