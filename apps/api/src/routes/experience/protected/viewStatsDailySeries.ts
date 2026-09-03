/**
 * GET /api/v1/protected/experiences/mine/views/daily-series
 *
 * Gap-filled daily view-count series for every experience listing owned by
 * the authenticated owner, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/daily-series.ts` (the accommodation twin). See
 * `viewStats.ts` in this same directory for the full gate-order rationale.
 *
 * @module routes/experience/protected/viewStatsDailySeries
 * @see HOS-734
 */

import { EntitlementKey } from '@repo/billing';
import type { ServiceErrorCode } from '@repo/schemas';
import { EntityTypeEnum, EntityViewWindowSchema, HostViewDailySeriesSchema } from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views/daily-series?window=7d|30d
 *
 * Authenticated owner endpoint that returns a gap-filled daily view-count
 * series aggregated across all of the caller's own experience listings.
 * Requires the `view_basic_stats` entitlement (same gate as `viewStats.ts`,
 * so both widgets are consistently accessible on the same plan tier).
 */
export const protectedExperienceViewStatsDailySeriesRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/views/daily-series',
    summary: 'Get daily view series for my experience listings',
    description:
        'Returns a gap-filled daily view-count series aggregated across all experience listings ' +
        'owned by the authenticated owner over a rolling window (7d or 30d). Each item ' +
        'represents one calendar day; days with no views have total = 0. Scoped strictly to ' +
        'actor.id — no owner override is accepted. Requires the view_basic_stats entitlement.',
    tags: ['Experience'],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: HostViewDailySeriesSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getDailySeriesForOwnCommerceListings({
            actor,
            entityType: EntityTypeEnum.EXPERIENCE,
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
        middlewares: [
            commerceVerticalEntitlementMiddleware('experience'),
            requireEntitlement(EntitlementKey.VIEW_BASIC_STATS)
        ],
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
