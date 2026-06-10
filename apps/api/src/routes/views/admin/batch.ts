/**
 * GET /api/v1/admin/views/batch
 *
 * Returns view-count statistics for a caller-supplied batch of entity IDs of a
 * single entity type, over a rolling window (7d or 30d). Zero-view entities are
 * included as `{ unique: 0, total: 0 }`.
 *
 * **Query params:**
 *   - `entityType` — entity type shared by all IDs in the batch.
 *   - `entityIds`  — comma-separated UUIDs (1–100 items).
 *   - `window`     — rolling window: '7d' or '30d' (default '30d').
 *
 * **Permission:** `ANALYTICS_VIEW`.
 *
 * **Response shape:** `{ data: EntityViewStats[] }` — one entry per requested ID.
 *
 * @module routes/views/admin/batch
 * @see SPEC-197 T-009
 */

import {
    AdminViewBatchQuerySchema,
    EntityViewStatsListSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * GET /batch?entityType=...&entityIds=uuid1,uuid2,...&window=30d
 *
 * Returns view stats for a batch of entities of the same type.
 * Requires `ANALYTICS_VIEW` permission.
 */
export const adminViewBatchRoute = createAdminRoute({
    method: 'get',
    path: '/batch',
    summary: 'Get view stats for a batch of entities',
    description:
        'Returns view-count statistics (unique + total) for a caller-supplied batch of ' +
        'entity IDs of a single entity type over a rolling 7-day or 30-day window. ' +
        'Entities with zero views are included as { unique: 0, total: 0 }. ' +
        'Accepts 1–100 UUIDs as a comma-separated query param. ' +
        'Requires ANALYTICS_VIEW permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.ANALYTICS_VIEW],
    requestQuery: AdminViewBatchQuerySchema.shape,
    responseSchema: EntityViewStatsListSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        // AdminViewBatchQuerySchema transforms the comma-separated entityIds string
        // into a UUID array at validation time; cast accordingly.
        const typedQuery = query as {
            entityType: string;
            entityIds: string[];
            window: '7d' | '30d';
        };

        const result = await entityViewService.getAdminBatch({
            actor,
            entityType: typedQuery.entityType as Parameters<
                typeof entityViewService.getAdminBatch
            >[0]['entityType'],
            entityIds: typedQuery.entityIds,
            window: typedQuery.window
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
