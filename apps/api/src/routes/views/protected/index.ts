/**
 * Protected view-stats routes (authentication required).
 *
 * All routes in this module require a valid Better Auth session and the
 * appropriate permission. The actor is resolved from context by
 * `getActorFromContext`; no caller-supplied owner IDs are accepted.
 *
 * Routes registered here:
 *   GET /accommodations/me             — host's own accommodation view stats (T-009)
 *   GET /accommodations/me/daily-series — host's own daily view-count series (SPEC-207)
 *   GET /posts                         — editor view stats for a batch of POSTs (T-010)
 *   GET /events                        — editor view stats for a batch of EVENTs (T-010)
 *   GET /:entityType/:entityId/traffic-stats — Umami traffic stats of one own listing (HOS-2119 T-048)
 *
 * @module routes/views/protected
 * @see SPEC-159 T-009, T-010
 * @see SPEC-207 §4.1
 */

import { createRouter } from '../../../utils/create-app';
import { hostAccommodationViewStatsRoute } from './accommodations-me';
import { hostAccommodationDailySeriesRoute } from './daily-series';
import { eventViewStatsRoute } from './events';
import { postViewStatsRoute } from './posts';
import { listingTrafficStatsRoute } from './traffic-stats';

const app = createRouter();

// T-009: host's own accommodation view stats
// Path: GET /accommodations/me — declared as /accommodations/me in the route file
app.route('/', hostAccommodationViewStatsRoute);

// SPEC-207: host's own daily view-count series (trend chart)
// Path: GET /accommodations/me/daily-series
app.route('/', hostAccommodationDailySeriesRoute);

// T-010: editor view stats for POSTs
// Path: GET /posts
app.route('/', postViewStatsRoute);

// T-010: editor view stats for EVENTs
// Path: GET /events
app.route('/', eventViewStatsRoute);

// HOS-2119 T-048: Umami traffic stats of one own listing
// Path: GET /:entityType/:entityId/traffic-stats (registered last: the static
// routes above are matched first)
app.route('/', listingTrafficStatsRoute);

export { app as protectedViewsRoutes };
