/**
 * Add bookmark to collection route.
 * Assigns an existing bookmark to a collection by updating the bookmark's collectionId.
 * @route POST /api/v1/protected/user-bookmark-collections/:id/bookmarks/:bookmarkId
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

export const addBookmarkToCollectionRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/bookmarks/{bookmarkId}',
    summary: 'Add bookmark to collection',
    description:
        'Assigns an existing bookmark to a collection by updating its collectionId. Both the collection and the bookmark must belong to the authenticated user. Returns 404 if either the collection or bookmark is not found, 403 if the actor is not the owner of either.',
    tags: ['User Bookmark Collections'],
    requestParams: UserBookmarkCollectionBookmarkParamsSchema.shape,
    responseSchema: UserBookmarkSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id, bookmarkId } = params as { id: string; bookmarkId: string };

        const result = await collectionService.addBookmarkToCollection(actor, {
            collectionId: id,
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
