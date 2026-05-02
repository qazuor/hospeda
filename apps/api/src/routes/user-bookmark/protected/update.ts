/**
 * Update user bookmark notes route.
 * Allows the authenticated owner to edit the `name` and/or `description` fields
 * of one of their bookmarks.
 * @route PATCH /api/v1/protected/user-bookmarks/{id}
 */
import {
    UserBookmarkIdSchema,
    UserBookmarkSchema,
    UserBookmarkUpdateNotesSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const updateUserBookmarkRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update user bookmark notes',
    description:
        'Updates the name and/or description of a bookmark owned by the authenticated user.',
    tags: ['User Bookmarks'],
    requestParams: {
        id: UserBookmarkIdSchema
    },
    requestBody: UserBookmarkUpdateNotesSchema,
    responseSchema: UserBookmarkSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const input = body as { name?: string; description?: string };

        const result = await bookmarkService.updateBookmark(actor, {
            bookmarkId: id,
            input
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
