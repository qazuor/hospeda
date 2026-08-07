/**
 * PATCH /api/v1/protected/posts/:id/media/reorder
 * Reorder photos in a post gallery (HOS-390).
 *
 * The caller supplies the full ordered list of visible media UUIDs. The service
 * validates that the supplied set matches the current visible rows exactly (no
 * extras, no missing entries, no duplicates) and then applies the new
 * `sortOrder` positions in a single transaction.
 *
 * Gated on the same permission as editing the post itself — enforced inside
 * `reorderPostMedia` via `checkPostCanEditMedia`.
 *
 * NOTE: `index.ts` registers this before /{id}/media/{mediaId} by convention.
 * That is defensive, not required — Hono resolves the static `reorder` segment
 * ahead of the `{mediaId}` param regardless of insertion order (verified by
 * mutation in `test/routes/post-protected-media.test.ts`).
 */
import {
    PostMediaListOutputSchema,
    type PostMediaReorderPayload,
    PostMediaReorderPayloadSchema
} from '@repo/schemas';
import { PostService, reorderPostMedia, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Route handler — reorders the gallery photos on a post.
 */
export const protectedReorderPostMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/reorder',
    summary: 'Reorder post gallery photos',
    description:
        'Sets the sortOrder for the visible gallery photos by supplying their UUIDs ' +
        'in the desired order. The supplied list must match the current visible rows ' +
        'exactly. Requires the same permission as updating the post.',
    tags: ['Post', 'Post Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: PostMediaReorderPayloadSchema,
    responseSchema: PostMediaListOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await reorderPostMedia(postService.model, actor, {
            postId: params.id as string,
            orderedIds: (body as PostMediaReorderPayload).orderedIds
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
