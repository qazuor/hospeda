/**
 * GET /api/v1/protected/gastronomies/mine/views
 *
 * Basic view-count statistics for the authenticated owner's own gastronomy
 * listings, over a rolling window (7d or 30d) — HOS-734.
 *
 * Mirrors `views/protected/accommodations-me.ts`: same `entity_views`
 * telemetry table, same `view_basic_stats` entitlement, applied to the
 * GASTRONOMY vertical instead of ACCOMMODATION. Advanced gastronomy analytics
 * (QR scans, most-viewed dishes) are explicitly OUT of scope — owner decision,
 * HOS-734 — and will define their own event catalog and entitlement key in a
 * follow-up spec.
 *
 * **Scope isolation:** `actor.id` resolves owned listing IDs internally — no
 * `ownerId` param is accepted (anti-peeking), same as the accommodation route.
 *
 * **Entitlement gate order (load-bearing):**
 * `commerceVerticalEntitlementMiddleware('gastronomy')` MUST run before
 * `requireEntitlement` — the global `entitlementMiddleware` has already put
 * the ACCOMMODATION entitlement set in the request context, which never
 * carries a commerce key (HOS-1074). `view_basic_stats` lives in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` (the floor every tier gets), not on
 * a specific plan row.
 *
 * @module routes/gastronomy/protected/viewStats
 * @see HOS-734
 */

import { EntitlementKey } from '@repo/billing';
import type { ServiceErrorCode } from '@repo/schemas';
import { EntityTypeEnum, EntityViewStatsListSchema, EntityViewWindowSchema } from '@repo/schemas';
import { entityViewService, ServiceError } from '@repo/service-core';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /mine/views?window=7d|30d
 *
 * Authenticated owner endpoint that returns view stats for all of the
 * caller's own gastronomy listings over the specified rolling window.
 * Requires the `view_basic_stats` entitlement (every gastronomy tier).
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
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.VIEW_BASIC_STATS)
        ],
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
