/**
 * GET /api/v1/protected/venues/mine/views
 *
 * Basic view-count statistics for the authenticated owner's own venue
 * listings, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/accommodations-me.ts`: same `entity_views`
 * telemetry table, applied to the VENUE vertical instead of ACCOMMODATION. Advanced venue analytics
 * (QR scans, most-viewed dishes) are explicitly OUT of scope — owner decision,
 * HOS-734 — and will define their own event catalog and entitlement key in a
 * follow-up spec.
 *
 * **Scope isolation:** `actor.id` resolves owned listing IDs internally — no
 * `ownerId` param is accepted (anti-peeking), same as the accommodation route.
 *
 *
 * @module routes/venue/protected/viewStats
 * @see HOS-734
 */

import type { ServiceErrorCode } from '@repo/schemas';
import {
    EntityTypeEnum,
    EntityViewStatsListSchema,
    EntityViewWindowSchema,
    VerticalEnum
} from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';

import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views?window=7d|30d
 *
 * Authenticated owner endpoint that returns view stats for all of the
 * caller's own venue listings over the specified rolling window.
 * Reads the owner's effective view_basic_stats capability before returning statistics.
 */
export const protectedVenueViewStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/views',
    summary: 'Get view stats for my gastronomy listings',
    description:
        'Returns view-count statistics for every gastronomy listing owned by the authenticated ' +
        'owner over a rolling window (7d or 30d). Scoped strictly to actor.id — no owner ' +
        'override is accepted. Requires the view_basic_stats entitlement.',
    tags: ['Venue'],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: EntityViewStatsListSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.VENUE,
            keys: ['view_basic_stats']
        });
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getStatsForOwnListings({
            actor,
            entityType: EntityTypeEnum.VENUE,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
