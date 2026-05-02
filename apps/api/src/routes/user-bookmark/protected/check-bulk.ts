/**
 * Bulk-check user bookmark status route.
 * Returns whether the authenticated user has bookmarked each of a list of entities.
 *
 * Used by listing pages to pre-hydrate FavoriteButton state in a single
 * request (SPEC-098 T-041) instead of issuing one /check call per card.
 *
 * @route POST /api/v1/protected/user-bookmarks/check-bulk
 */
import {
    UserBookmarksCheckBulkRequestSchema,
    UserBookmarksCheckBulkResponseSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const checkBulkUserBookmarksRoute = createProtectedRoute({
    method: 'post',
    path: '/check-bulk',
    summary: 'Bulk-check bookmark status',
    description:
        'Checks bookmark status for many entities of the same type in a single request. Returns a map keyed by entityId.',
    tags: ['User Bookmarks'],
    requestBody: UserBookmarksCheckBulkRequestSchema,
    responseSchema: UserBookmarksCheckBulkResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof UserBookmarksCheckBulkRequestSchema>;

        const result = await bookmarkService.checkBookmarksBulk(actor, {
            userId: actor.id,
            entityType: input.entityType,
            entityIds: input.entityIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { checks: result.data?.checks ?? {} };
    }
});
