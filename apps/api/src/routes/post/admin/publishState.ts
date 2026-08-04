/**
 * Admin publish-state post endpoint — HOS-374 §7.6.4.
 *
 * Raises or lowers a post's publication by writing `visibility` and nothing
 * else, so unpublishing never discards the moderation verdict.
 *
 * Publish and unpublish are one permission on purpose: "may publish but may not
 * unpublish" would let someone push content live with no way to pull it back.
 *
 * @module routes/post/admin/publishState
 */
import {
    ContentPublishStateInputSchema,
    PermissionEnum,
    PostAdminSchema,
    PostIdSchema
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/posts/:id/publish-state
 *
 * @throws 400 if `visibility` is not a valid visibility value.
 * @throws 403 if the actor lacks `POST_PUBLISH_TOGGLE`.
 * @throws 404 if the post does not exist.
 */
export const adminSetPostPublishStateRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/publish-state',
    summary: 'Set post publication state (admin)',
    description:
        'Sets the post visibility (PUBLIC | PRIVATE | RESTRICTED). Leaves the moderation ' +
        'verdict intact, so republishing does not re-enter the review queue. ' +
        'Requires POST_PUBLISH_TOGGLE.',
    tags: ['Posts', 'Admin'],
    requiredPermissions: [PermissionEnum.POST_PUBLISH_TOGGLE],
    requestParams: { id: PostIdSchema },
    requestBody: ContentPublishStateInputSchema,
    responseSchema: PostAdminSchema,
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
