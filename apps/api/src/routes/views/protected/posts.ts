/**
 * GET /api/v1/protected/views/posts
 *
 * Returns view-count statistics for a caller-supplied batch of POST entities
 * over a rolling window (7d or 30d).
 *
 * **Query params:**
 *   - `window` — rolling window: '7d' or '30d' (default '30d').
 *   - `entityIds` — comma-separated or repeated UUIDs of the posts to query
 *     (1–100 IDs). Invalid UUIDs or more than 100 IDs produce a 400.
 *
 * **Permission:** `POST_VIEW_ALL`.
 *
 * **Response shape:** `{ data: EntityViewStats[] }` — one entry per requested
 * post ID, zero-view entities included as `{ unique: 0, total: 0 }`.
 *
 * @module routes/views/protected/posts
 * @see SPEC-159 T-010
 */

import {
    EntityTypeEnum,
    EntityViewStatsListResponseSchema,
    EntityViewWindowSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, entityViewService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * Shared `entityIds` query param schema — accepts repeated params or a
 * comma-separated string, validates each element as a UUID v4, and caps
 * the list at 100 entries (SPEC-159 §5 dashboard widget cap).
 *
 * Follows the same union pattern used by accommodation amenity/feature filters
 * in `accommodation.http.schema.ts`.
 */
const entityIdsQuerySchema = z
    .union([
        // Repeated param: ?entityIds=uuid1&entityIds=uuid2
        z.array(z.string().uuid({ message: 'zodError.entityView.entityId.invalidUuid' })),
        // Comma-separated: ?entityIds=uuid1,uuid2
        z
            .string()
            .transform((val) =>
                val
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            )
            .pipe(z.array(z.string().uuid({ message: 'zodError.entityView.entityId.invalidUuid' })))
    ])
    .refine((ids) => ids.length >= 1, {
        message: 'zodError.entityView.editorStats.entityIds.empty'
    })
    .refine((ids) => ids.length <= 100, {
        message: 'zodError.entityView.editorStats.entityIds.tooMany'
    });

/**
 * GET /posts?window=7d|30d&entityIds=uuid1,uuid2,...
 *
 * Returns view stats for a batch of POST entities (editor dashboard widget).
 * Requires `POST_VIEW_ALL` permission.
 */
export const postViewStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/posts',
    summary: 'Get view stats for posts',
    description:
        'Returns view-count statistics for a batch of POST entities over a rolling window ' +
        '(7d or 30d). Accepts up to 100 entity IDs as repeated params or a comma-separated ' +
        'string. Requires POST_VIEW_ALL permission.',
    tags: ['Views'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    requestQuery: {
        window: EntityViewWindowSchema.default('30d'),
        entityIds: entityIdsQuerySchema
    },
    responseSchema: EntityViewStatsListResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = query as { window: '7d' | '30d'; entityIds: string[] };

        const result = await entityViewService.getStatsForEditorEntities({
            actor,
            entityType: EntityTypeEnum.POST,
            entityIds: typedQuery.entityIds,
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
