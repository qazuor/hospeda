/**
 * GET /api/v1/protected/posts/:id/media
 * List photos in a post gallery (HOS-390).
 *
 * Returns all non-deleted `post_media` rows for the given post, ordered by
 * `sortOrder ASC`. Supports an optional `state` query filter (defaults to
 * `'visible'`).
 *
 * Gated on the same permission as editing the post itself — enforced inside
 * `getPostMedia` via `checkPostCanEditMedia`. There is no separate public read
 * path for media management: public consumers read the composed `media` field
 * on the post.
 */
import { ContentMediaStateSchema, PostMediaListOutputSchema } from '@repo/schemas';
import { getPostMedia, PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * Route handler — lists the gallery photos for a post.
 */
export const protectedGetPostMediaRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/media',
    summary: 'List post gallery photos',
    description:
        'Retrieves all media rows for a post, ordered by sortOrder ASC. ' +
        'Supports an optional `state` query filter (default: visible). ' +
        'Requires the same permission as updating the post.',
    tags: ['Post', 'Post Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        state: ContentMediaStateSchema.optional()
    },
    responseSchema: PostMediaListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Extract optional state query param.
        const rawState = ctx.req.query('state');
        const stateParsed = rawState
            ? ContentMediaStateSchema.safeParse(rawState)
            : { success: false as const };
        const state = stateParsed.success ? stateParsed.data : undefined;

        const result = await getPostMedia(postService.model, actor, {
            postId: params.id as string,
            state
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { media: result.data?.media ?? [] };
    }
});
