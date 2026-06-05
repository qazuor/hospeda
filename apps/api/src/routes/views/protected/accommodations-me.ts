/**
 * GET /api/v1/protected/views/accommodations/me
 *
 * Returns view-count statistics for every accommodation owned by the
 * authenticated host over a rolling window (7d or 30d).
 *
 * **Scope isolation:** `actor.id` is used internally to resolve owned
 * accommodation IDs — no `ownerId` param is accepted, preventing cross-host
 * peeking. The service enforces `ACCOMMODATION_VIEW_OWN`.
 *
 * **Response shape:** `{ data: EntityViewStats[] }` — one entry per owned
 * accommodation, zero-view entities included as `{ unique: 0, total: 0 }`.
 *
 * @module routes/views/protected/accommodations-me
 * @see SPEC-159 T-009
 */

import {
    EntityViewStatsListResponseSchema,
    EntityViewWindowSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /accommodations/me?window=7d|30d
 *
 * Authenticated host endpoint that returns view stats for all of the host's
 * own accommodations over the specified rolling window. Requires
 * `ACCOMMODATION_VIEW_OWN` permission (standard host-tier).
 */
export const hostAccommodationViewStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/accommodations/me',
    summary: 'Get view stats for my accommodations',
    description:
        'Returns view-count statistics for every accommodation owned by the authenticated ' +
        'host over a rolling window (7d or 30d). Scoped strictly to actor.id — no owner ' +
        'override is accepted. Requires ACCOMMODATION_VIEW_OWN permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: EntityViewStatsListResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getStatsForHostAccommodations({
            actor,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return { data: result.data };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
