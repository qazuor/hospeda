/**
 * Delete user bookmark route.
 * Soft-deletes a bookmark owned by the authenticated user.
 * @route DELETE /api/v1/protected/user-bookmarks/{id}
 */
import { UserBookmarkIdSchema } from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const deleteUserBookmarkRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete user bookmark',
    description: 'Soft-deletes a bookmark. Only the bookmark owner can delete it.',
    tags: ['User Bookmarks'],
    requestParams: {
        id: UserBookmarkIdSchema
    },
    responseSchema: z.object({
        count: z.number()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await bookmarkService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
