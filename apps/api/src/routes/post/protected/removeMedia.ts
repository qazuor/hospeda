/**
 * DELETE /api/v1/protected/posts/:id/media/:mediaId
 * Remove (soft-delete) a photo from a post gallery (HOS-390).
 *
 * Soft-deletes the `post_media` row identified by `mediaId` and resequences the
 * remaining visible rows to a dense 0-based `sortOrder`. Both operations run in
 * a single transaction inside the service.
 *
 * Deletes the Cloudinary binary as well: the provider is passed down so the
 * asset is removed BEFORE the row, aborting the whole operation if storage
 * fails rather than leaving a permanently-billed orphan.
 *
 * Gated on the same permission as editing the post itself — enforced inside
 * `removePostMedia` via `checkPostCanEditMedia`.
 */
import { SuccessSchema } from '@repo/schemas';
import { PostService, removePostMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific photo from a post gallery.
 */
export const protectedRemovePostMediaRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/media/{mediaId}',
    summary: 'Remove photo from post gallery',
    description:
        'Soft-deletes a media row and resequences the remaining visible photos. ' +
        'Requires the same permission as updating the post.',
    tags: ['Post', 'Post Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await removePostMedia(
            postService.model,
            actor,
            {
                postId: params.id as string,
                mediaId: params.mediaId as string
            },
            getMediaProvider()
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    }
});
