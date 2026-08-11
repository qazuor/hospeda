/**
 * PUT /api/v1/admin/posts/:id/media/:mediaId/featured
 * Set the featured photo for a post gallery (HOS-390).
 *
 * Promotes the target `post_media` row to `is_featured = true` and demotes the
 * previous featured row (if any) back to `is_featured = false`. Both operations
 * run in a single DB transaction — clear-then-set order is mandatory to avoid
 * transiently violating the partial unique index on (post_id) WHERE
 * is_featured = true AND deleted_at IS NULL.
 *
 * The target media row MUST be `state = 'visible'` — archived photos are
 * rejected before reaching the DB (CHECK constraint guard).
 *
 * No request body — postId and mediaId come from URL params.
 *
 * Gated on POST_UPDATE, the broad grant — enforced inside
 * `setFeaturedPostMedia` via `checkPostCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention —
 * defensive only; see the reorder-route note.
 */
import { PermissionEnum, PostMediaSingleOutputSchema } from '@repo/schemas';
import { PostService, ServiceError, setFeaturedPostMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Route handler — promotes a photo to featured on a post.
 */
export const adminSetFeaturedPostMediaRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/media/{mediaId}/featured',
    summary: 'Set featured photo for post gallery (admin)',
    description:
        'Promotes the target media row to is_featured=true and demotes the previous ' +
        'featured row (if any). Archived photos cannot be featured — restore the ' +
        'photo to visible first. Requires POST_UPDATE. ' +
        'No request body — ids come from URL params.',
    tags: ['Post', 'Media'],
    requiredPermissions: [PermissionEnum.POST_UPDATE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: PostMediaSingleOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await setFeaturedPostMedia(postService.model, actor, {
            postId: params.id as string,
            mediaId: params.mediaId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
