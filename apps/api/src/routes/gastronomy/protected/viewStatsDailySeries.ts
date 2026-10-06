/**
 * GET /api/v1/protected/gastronomies/mine/views/daily-series
 *
 * Gap-filled daily view-count series for every gastronomy listing owned by
 * the authenticated owner, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/daily-series.ts` (the accommodation twin). See
 * `viewStats.ts` in this same directory for the shared stats read.
 *
 * @module routes/gastronomy/protected/viewStatsDailySeries
 * @see HOS-734
 */

import type { ServiceErrorCode } from '@repo/schemas';
import { EntityTypeEnum, EntityViewWindowSchema, HostViewDailySeriesSchema } from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views/daily-series?window=7d|30d
 *
 * Authenticated owner endpoint that returns a gap-filled daily view-count
 * series aggregated across all of the caller's own gastronomy listings.
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the stats plan gate is removed.
 */
export const protectedGastronomyViewStatsDailySeriesRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/views/daily-series',
    summary: 'Get daily view series for my gastronomy listings',
    description:
        'Returns a gap-filled daily view-count series aggregated across all gastronomy listings ' +
        'owned by the authenticated owner over a rolling window (7d or 30d). Each item ' +
        'represents one calendar day; days with no views have total = 0. Scoped strictly to ' +
        'actor.id — no owner override is accepted. Requires the view_basic_stats entitlement.',
    tags: ['Gastronomy'],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: HostViewDailySeriesSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed VIEW_BASIC_STATS entitlement gate.
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getDailySeriesForOwnCommerceListings({
            actor,
            entityType: EntityTypeEnum.GASTRONOMY,
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
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
