/**
 * POST /api/v1/protected/posts/:id/media
 * Add a photo to a post gallery (HOS-390).
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via the media-upload endpoint. This endpoint registers the returned
 * URL + metadata as a new `post_media` row.
 *
 * Gated on the same permission as editing the post itself — enforced inside
 * `addPostMedia` via `checkPostCanEditMedia`.
 */
import {
    type PostMediaAddInput,
    type PostMediaAddPayload,
    PostMediaAddPayloadSchema,
    PostMediaSingleOutputSchema
} from '@repo/schemas';
import { addPostMedia, PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Route handler — adds a photo to the specified post's gallery.
 */
export const protectedAddPostMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to post gallery',
    description:
        'Registers an already-uploaded URL as a new post_media row. ' +
        'Requires the same permission as updating the post.',
    tags: ['Post', 'Post Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: PostMediaAddPayloadSchema,
    responseSchema: PostMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: PostMediaAddInput = {
            postId: params.id as string,
            media: body as PostMediaAddPayload
        };

        const result = await addPostMedia(postService.model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
