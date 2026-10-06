/**
 * GET /api/v1/protected/views/accommodations/me/daily-series
 *
 * Returns a gap-filled daily view-count series for every accommodation owned
 * by the authenticated host over a rolling window (7d or 30d).
 *
 * **Scope isolation:** `actor.id` is used internally to resolve owned
 * accommodation IDs — no `ownerId` param is accepted, preventing cross-host
 * peeking. The service enforces `ACCOMMODATION_VIEW_OWN`.
 *
 * **Response shape:** `{ window, items: { date, total }[] }` — exactly
 * `windowDays` items, one per calendar day, ordered oldest → newest.
 * Gap-filled days (no views) have `total: 0`.
 *
 * @module routes/views/protected/daily-series
 * @see SPEC-207 §4.1
 */

import {
    EntityViewWindowSchema,
    HostViewDailySeriesSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /accommodations/me/daily-series?window=7d|30d
 *
 * Authenticated host endpoint that returns a gap-filled daily view-count series
 * aggregated across all of the host's own accommodations. Requires
 * `ACCOMMODATION_VIEW_OWN` permission (standard host-tier) and
 * `VIEW_BASIC_STATS` entitlement.
 */
export const hostAccommodationDailySeriesRoute = createProtectedRoute({
    method: 'get',
    path: '/accommodations/me/daily-series',
    summary: 'Get daily view series for my accommodations',
    description:
        'Returns a gap-filled daily view-count series aggregated across all accommodations ' +
        'owned by the authenticated host over a rolling window (7d or 30d). Each item ' +
        'represents one calendar day; days with no views have total = 0. Scoped strictly ' +
        'to actor.id — no owner override is accepted. Requires ACCOMMODATION_VIEW_OWN permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: HostViewDailySeriesSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed VIEW_BASIC_STATS entitlement gate.
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getDailySeriesForHostAccommodations({
            actor,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            window: typedQuery.window,
            items: result.data
        };
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
