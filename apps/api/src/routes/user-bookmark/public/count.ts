/**
 * Public endpoint to count bookmarks for a given entity.
 * Returns the total number of users who have bookmarked a specific entity.
 * No authentication required — counts are public, non-personalized data.
 *
 * @route GET /api/v1/public/user-bookmarks/count
 */
import type { UserBookmarkCountByEntityInput } from '@repo/schemas';
import { UserBookmarkCountByEntitySchema, UserBookmarkCountResponseSchema } from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

/**
 * Handler for counting bookmarks for a given entity.
 *
 * @param ctx - Hono context (guest actor resolved by actorMiddleware)
 * @param _params - Path parameters (unused)
 * @param _body - Request body (unused)
 * @param query - Validated query parameters containing entityType and entityId
 * @returns Object with `count` number representing total bookmarks for the entity
 */
const countBookmarksForEntityHandler = async (
    ctx: Context,
    _params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
) => {
    const actor = getActorFromContext(ctx);

    // query is validated by the route factory via requestQuery schema before
    // reaching this handler, so these casts are safe.
    const params = query as unknown as UserBookmarkCountByEntityInput;

    const result = await bookmarkService.countBookmarksForEntity(actor, {
        entityId: params.entityId,
        entityType: params.entityType
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return result.data;
};

/**
 * GET /api/v1/public/user-bookmarks/count
 * Public endpoint to retrieve how many users have bookmarked a specific entity.
 * Results are aggressively cached because they are not personalized.
 */
export const publicCountBookmarksForEntityRoute = createPublicRoute({
    method: 'get',
    path: '/count',
    summary: 'Count bookmarks for an entity',
    description:
        'Returns the total number of users who have bookmarked a specific entity. ' +
        'No authentication required. Results are cached for 60 seconds.',
    tags: ['User Bookmarks'],
    requestQuery: UserBookmarkCountByEntitySchema.shape,
    responseSchema: UserBookmarkCountResponseSchema,
    handler: countBookmarksForEntityHandler,
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
