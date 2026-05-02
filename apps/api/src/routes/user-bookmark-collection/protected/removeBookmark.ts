/**
 * Remove bookmark from collection route.
 * Removes a bookmark from its current collection by setting collectionId to null.
 * The collection :id is present in the URL for REST semantics but the service
 * only needs the bookmarkId to perform the operation.
 * @route DELETE /api/v1/protected/user-bookmark-collections/:id/bookmarks/:bookmarkId
 */
import {
    ServiceErrorCode,
    UserBookmarkCollectionBookmarkParamsSchema,
    UserBookmarkSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

export const removeBookmarkFromCollectionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}/bookmarks/{bookmarkId}',
    summary: 'Remove bookmark from collection',
    description:
        'Removes a bookmark from its current collection by setting its collectionId to null. The :id (collection UUID) is part of the URL for REST semantics only; the service identifies the bookmark by :bookmarkId. Returns 404 if the bookmark is not found, 403 if the actor is not the owner.',
    tags: ['User Bookmark Collections'],
    requestParams: UserBookmarkCollectionBookmarkParamsSchema.shape,
    responseSchema: UserBookmarkSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        // id (collection) is present in URL for REST semantics; service only uses bookmarkId
        const { bookmarkId } = params as { id: string; bookmarkId: string };

        const result = await collectionService.removeBookmarkFromCollection(actor, {
            bookmarkId
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
        return result.data!;
    }
});
