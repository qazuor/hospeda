/**
 * List user bookmarks route.
 * Returns paginated bookmarks for the authenticated user, optionally filtered by entity type.
 * @route GET /api/v1/protected/user-bookmarks
 */
import { type EntityTypeEnum, UserBookmarkSchema } from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams } from '../../../utils/pagination';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const listUserBookmarksRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List user bookmarks',
    description:
        'Returns paginated bookmarks for the authenticated user. Optionally filter by entity type.',
    tags: ['User Bookmarks'],
    requestQuery: {
        entityType: z
            .enum(['ACCOMMODATION', 'DESTINATION', 'ATTRACTION', 'EVENT', 'POST'])
            .optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10)
    },
    responseSchema: z.object({
        bookmarks: z.array(UserBookmarkSchema),
        total: z.number()
    }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const entityType = query?.entityType as EntityTypeEnum | undefined;

        const result = await bookmarkService.listBookmarksByUser(actor, {
            userId: actor.id,
            page,
            pageSize,
            ...(entityType ? { entityType } : {})
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
