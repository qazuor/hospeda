/**
 * Delete user bookmark collection route.
 * Soft-deletes a collection owned by the authenticated user and nullifies
 * the collectionId on all bookmarks that belonged to it.
 * @route DELETE /api/v1/protected/user-bookmark-collections/:id
 */
import { ServiceErrorCode, UserBookmarkCollectionIdParamSchema } from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/**
 * Response schema for the DELETE endpoint.
 * Returns the deleted collection ID and the number of bookmarks nullified.
 */
const DeleteCollectionResponseSchema = z.object({
    id: z.string().uuid(),
    nullifiedBookmarks: z.number().int().min(0)
});

export const deleteUserBookmarkCollectionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete user bookmark collection',
    description:
        'Soft-deletes a bookmark collection owned by the authenticated user. Also nullifies the collectionId on all bookmarks that belonged to it (atomic operation). Returns 404 if not found, 403 if not owner.',
    tags: ['User Bookmark Collections'],
    requestParams: UserBookmarkCollectionIdParamSchema.shape,
    responseSchema: DeleteCollectionResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params as { id: string };

        const result = await collectionService.deleteCollection(actor, id);

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
