/**
 * GET /api/v1/protected/venues/mine/views/daily-series
 *
 * Gap-filled daily view-count series for every gastronomy listing owned by
 * the authenticated owner, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/daily-series.ts` (the accommodation twin). See
 * `viewStats.ts` in this same directory for the shared stats read.
 *
 * @module routes/venue/protected/viewStatsDailySeries
 * @see HOS-734
 */

import type { ServiceErrorCode } from '@repo/schemas';
import {
    EntityTypeEnum,
    EntityViewWindowSchema,
    HostViewDailySeriesSchema,
    VerticalEnum
} from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views/daily-series?window=7d|30d
 *
 * Authenticated owner endpoint that returns a gap-filled daily view-count
 * series aggregated across all of the caller's own gastronomy listings.
 * Reads the owner's effective view_basic_stats capability before returning statistics.
 */
export const protectedVenueViewStatsDailySeriesRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/views/daily-series',
    summary: 'Get daily view series for my gastronomy listings',
    description:
        'Returns a gap-filled daily view-count series aggregated across all gastronomy listings ' +
        'owned by the authenticated owner over a rolling window (7d or 30d). Each item ' +
        'represents one calendar day; days with no views have total = 0. Scoped strictly to ' +
        'actor.id — no owner override is accepted. Requires the view_basic_stats entitlement.',
    tags: ['Venue'],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: HostViewDailySeriesSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.VENUE,
            keys: ['view_basic_stats']
        });
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getDailySeriesForOwnListings({
            actor,
            entityType: EntityTypeEnum.VENUE,
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
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
