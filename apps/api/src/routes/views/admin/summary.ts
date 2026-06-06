/**
 * GET /api/v1/admin/views/summary
 *
 * Returns platform-wide view-count totals per entity type (ACCOMMODATION, POST,
 * EVENT) over a rolling window (7d or 30d). Missing entity types are zero-filled
 * by the service so the response always contains exactly three items.
 *
 * **Query params:**
 *   - `window` — rolling window: '7d' or '30d' (default '30d').
 *
 * **Permission:** `ANALYTICS_VIEW`.
 *
 * **Response shape:** `{ data: AdminViewSummaryItem[] }` — exactly three items.
 *
 * @module routes/views/admin/summary
 * @see SPEC-197 T-008
 */

import {
    AdminViewSummaryListSchema,
    EntityViewWindowSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * GET /summary?window=7d|30d
 *
 * Returns platform-wide view-count summary aggregated by entity type.
 * Requires `ANALYTICS_VIEW` permission.
 */
export const adminViewSummaryRoute = createAdminRoute({
    method: 'get',
    path: '/summary',
    summary: 'Get platform-wide view count summary',
    description:
        'Returns view-count totals (unique + total) for each trackable entity type ' +
        '(ACCOMMODATION, POST, EVENT) over a rolling 7-day or 30-day window. ' +
        'Missing entity types are zero-filled; always returns exactly three items. ' +
        'Requires ANALYTICS_VIEW permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ANALYTICS_VIEW],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d')
    },
    responseSchema: AdminViewSummaryListSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d' };

        const result = await entityViewService.getAdminSummary({
            actor,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
