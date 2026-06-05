/**
 * GET /api/v1/admin/views/daily-series
 *
 * Returns the 30-day daily view-count series grouped by entity type. The
 * response is gap-filled to exactly 90 rows (3 entity types × 30 days); days
 * with no views are zero-filled.
 *
 * V1 has no query params — the window is fixed at 30 days.
 *
 * **Permission:** `ANALYTICS_VIEW`.
 *
 * **Response shape:**
 *   `{ data: Array<{ date: string; entityType: TrackableEntityType; total: number }> }`
 *   Always 90 rows ordered by date ASC, entityType ASC.
 *
 * @module routes/views/admin/daily-series
 * @see SPEC-197 T-011
 */

import {
    AdminViewDailySeriesResponseSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** Fixed window for V1: 30 days. */
const DAILY_SERIES_WINDOW_DAYS = 30;

/**
 * GET /daily-series
 *
 * Returns the 30-day daily view-count series (90 rows, gap-filled).
 * Requires `ANALYTICS_VIEW` permission.
 */
export const adminViewDailySeriesRoute = createAdminRoute({
    method: 'get',
    path: '/daily-series',
    summary: 'Get 30-day daily view-count series',
    description:
        'Returns the 30-day daily view-count series grouped by entity type. ' +
        'The response is gap-filled to exactly 90 rows (3 entity types × 30 days); ' +
        'days with no views are emitted as { total: 0 }. ' +
        'V1 has no query params — the window is hardcoded at 30 days. ' +
        'Requires ANALYTICS_VIEW permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ANALYTICS_VIEW],
    responseSchema: AdminViewDailySeriesResponseSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await entityViewService.getAdminDailySeries({
            actor,
            windowDays: DAILY_SERIES_WINDOW_DAYS
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return { data: result.data };
    }
});
