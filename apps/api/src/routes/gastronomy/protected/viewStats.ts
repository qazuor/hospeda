/**
 * GET /api/v1/protected/gastronomies/mine/views
 *
 * Basic view-count statistics for the authenticated owner's own gastronomy
 * listings, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/accommodations-me.ts`: same `entity_views`
 * telemetry table, applied to the GASTRONOMY vertical instead of ACCOMMODATION. Advanced gastronomy analytics
 * (QR scans, most-viewed dishes) are explicitly OUT of scope — owner decision,
 * HOS-734 — and will define their own event catalog and entitlement key in a
 * follow-up spec.
 *
 * **Scope isolation:** `actor.id` resolves owned listing IDs internally — no
 * `ownerId` param is accepted (anti-peeking), same as the accommodation route.
 *
 * HOS-1352: transitional until V3 (HOS-1357), see PR — former plan entitlement gate removed.
 *
 * @module routes/gastronomy/protected/viewStats
 * @see HOS-734
 */

import type { ServiceErrorCode } from '@repo/schemas';
import { EntityTypeEnum, EntityViewStatsListSchema, EntityViewWindowSchema } from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';

import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views?window=7d|30d
 *
 * Authenticated owner endpoint that returns view stats for all of the
 * caller's own gastronomy listings over the specified rolling window.
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the stats plan gate is removed.
 */
export const protectedGastronomyViewStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/views',
    summary: 'Get view stats for my gastronomy listings',
    description:
        'Returns view-count statistics for every gastronomy listing owned by the authenticated ' +
        'owner over a rolling window (7d or 30d). Scoped strictly to actor.id — no owner ' +
        'override is accepted. Requires the view_basic_stats entitlement.',
    tags: ['Gastronomy'],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: EntityViewStatsListSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed VIEW_BASIC_STATS entitlement gate.
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getStatsForOwnCommerceListings({
            actor,
            entityType: EntityTypeEnum.GASTRONOMY,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
