/**
 * Protected publish-state post endpoint — HOS-374 §7.6.4.
 *
 * The trusted editor's own publication switch: raises or lowers `visibility`
 * on a post they authored, without touching the moderation verdict, so
 * unpublishing → editing → republishing never re-enters the review queue.
 *
 * Authorization lives entirely in `PostService.setPublishState()`, which
 * accepts either `POST_PUBLISH_TOGGLE` (any post) or `POST_PUBLISH_OWN` plus
 * authorship. The route declares no `requiredPermissions` because the
 * author-scoped half of that rule cannot be expressed without the post.
 *
 * @module routes/post/protected/publishState
 */
import { ContentPublishStateInputSchema, PostIdSchema, PostProtectedSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/protected/posts/:id/publish-state
 *
 * @throws 400 if `visibility` is not a valid visibility value.
 * @throws 403 if the actor is not the author, or is the author but lacks
 *         `POST_PUBLISH_OWN`.
 * @throws 404 if the post does not exist.
 */
export const protectedSetPostPublishStateRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/publish-state',
    summary: 'Set publication state of own post',
    description:
        'Publishes or unpublishes a post the actor authored. Requires POST_PUBLISH_OWN ' +
        '(or POST_PUBLISH_TOGGLE for any post). Leaves the moderation verdict intact.',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    requestBody: ContentPublishStateInputSchema,
    responseSchema: PostProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { visibility } = ContentPublishStateInputSchema.parse(body);

        const result = await postService.setPublishState({
            actor,
            id: params.id as string,
            visibility
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
