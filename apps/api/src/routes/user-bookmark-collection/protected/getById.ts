/**
 * Get user bookmark collection by ID route.
 * Returns a single collection for the authenticated user, optionally including
 * a paginated list of its bookmarks.
 * @route GET /api/v1/protected/user-bookmark-collections/:id
 */
import {
    ServiceErrorCode,
    UserBookmarkCollectionDetailResponseSchema,
    UserBookmarkCollectionIdParamSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/**
 * Query schema for the GET /:id endpoint with optional bookmark pagination and filtering.
 */
const GetCollectionByIdQuerySchema = {
    bookmarksPage: z.coerce.number().int().min(1).default(1),
    bookmarksPageSize: z.coerce.number().int().min(1).max(100).default(20),
    entityType: z.enum(['ACCOMMODATION', 'DESTINATION', 'ATTRACTION', 'EVENT', 'POST']).optional()
};

export const getUserBookmarkCollectionByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get user bookmark collection by ID',
    description:
        'Returns a single bookmark collection for the authenticated user. Optionally includes a paginated list of its bookmarks. Returns 404 if not found, 403 if the actor is not the owner.',
    tags: ['User Bookmark Collections'],
    requestParams: UserBookmarkCollectionIdParamSchema.shape,
    requestQuery: GetCollectionByIdQuerySchema,
    responseSchema: UserBookmarkCollectionDetailResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params as { id: string };

        const bookmarksPage = typeof query?.bookmarksPage === 'number' ? query.bookmarksPage : 1;
        const bookmarksPageSize =
            typeof query?.bookmarksPageSize === 'number' ? query.bookmarksPageSize : 20;
        const entityType = query?.entityType as
            | 'ACCOMMODATION'
            | 'DESTINATION'
            | 'ATTRACTION'
            | 'EVENT'
            | 'POST'
            | undefined;

        const result = await collectionService.getCollectionById(actor, {
            collectionId: id,
            includeBookmarks: true,
            bookmarksPage,
            bookmarksPageSize,
            ...(entityType ? { entityType } : {})
        });

        if (result.error) {
            const { code, message } = result.error;

            if (code === ServiceErrorCode.NOT_FOUND) {
                throw new HTTPException(404, { message });
            }

            if (code === ServiceErrorCode.FORBIDDEN) {
                throw new HTTPException(403, { message });
            }

            throw new ServiceError(code, message, result.error.details);
        }

        // result.data is guaranteed when result.error is absent
        // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
        const { collection, bookmarks } = result.data!;

        return {
            ...collection,
            bookmarks: bookmarks
                ? {
                      data: bookmarks.rows,
                      pagination: {
                          page: bookmarks.page,
                          pageSize: bookmarks.pageSize,
                          total: bookmarks.total,
                          totalPages: Math.ceil(bookmarks.total / bookmarks.pageSize),
                          hasNextPage: bookmarks.page * bookmarks.pageSize < bookmarks.total,
                          hasPreviousPage: bookmarks.page > 1
                      }
                  }
                : undefined
        };
    }
});
