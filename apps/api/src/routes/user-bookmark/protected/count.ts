/**
 * Count user bookmarks route.
 * Returns the bookmark count for the authenticated user, optionally filtered by entity type.
 * @route GET /api/v1/protected/user-bookmarks/count
 */
import type { EntityTypeEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const countUserBookmarksRoute = createProtectedRoute({
    method: 'get',
    path: '/count',
    summary: 'Count user bookmarks',
    description:
        'Returns the total bookmark count for the authenticated user. Optionally filter by entity type.',
    tags: ['User Bookmarks'],
    requestQuery: {
        entityType: z
            .enum(['ACCOMMODATION', 'DESTINATION', 'ATTRACTION', 'EVENT', 'POST'])
            .optional()
    },
    responseSchema: z.object({
        count: z.number()
    }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const entityType = query?.entityType as EntityTypeEnum | undefined;

        const result = await bookmarkService.countBookmarksForUser(actor, {
            userId: actor.id,
            ...(entityType ? { entityType } : {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
