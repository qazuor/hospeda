/**
 * GET /api/v1/admin/views/top
 *
 * Returns the top-N most-viewed entities for a given entity type and rolling
 * window, ordered by total views descending. Result length is at most `limit`.
 *
 * **Query params:**
 *   - `entityType` — entity type to rank.
 *   - `window`     — rolling window: '7d' or '30d' (default '30d').
 *   - `limit`      — integer 1–50 (default 10).
 *
 * **Permission:** `ANALYTICS_VIEW`.
 *
 * **Response shape:** `{ data: EntityViewStats[] }` — ordered by total DESC,
 * length ≤ limit.
 *
 * @module routes/views/admin/top
 * @see SPEC-197 T-010
 */

import {
    AdminViewTopQuerySchema,
    EntityViewStatsListSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** Maps the '7d'/'30d' window enum to the numeric windowDays expected by the service. */
const WINDOW_DAYS: Record<'7d' | '30d', number> = {
    '7d': 7,
    '30d': 30
};

/**
 * GET /top?entityType=...&window=30d&limit=10
 *
 * Returns the top-N most-viewed entities of the given type.
 * Requires `ANALYTICS_VIEW` permission.
 */
export const adminViewTopRoute = createAdminRoute({
    method: 'get',
    path: '/top',
    summary: 'Get top-N most-viewed entities',
    description:
        'Returns the top-N most-viewed entities of a given entity type over a rolling ' +
        '7-day or 30-day window, ordered by total views descending. ' +
        'Limit is capped at 50; defaults to 10. ' +
        'Requires ANALYTICS_VIEW permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ANALYTICS_VIEW],
    requestQuery: AdminViewTopQuerySchema.shape,
    responseSchema: EntityViewStatsListSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as {
            entityType: string;
            window: '7d' | '30d';
            limit: number;
        };

        const windowDays = WINDOW_DAYS[typedQuery.window];

        const result = await entityViewService.getAdminTopEntities({
            actor,
            entityType: typedQuery.entityType as Parameters<
                typeof entityViewService.getAdminTopEntities
            >[0]['entityType'],
            windowDays,
            limit: typedQuery.limit
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
