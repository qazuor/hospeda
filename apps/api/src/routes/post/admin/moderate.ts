/**
 * Admin moderate post endpoint — HOS-374 §7.6.4.
 *
 * Applies the platform's moderation verdict to one post. Delegates to
 * `PostService.moderate()`, which gates the action on
 * {@link PermissionEnum.POST_MODERATION_CHANGE} and writes `moderationState`
 * and nothing else.
 *
 * Until this route existed the verdict was set through the generic update,
 * behind plain `POST_UPDATE` — which is what made every publication gate in the
 * model bypassable.
 *
 * @module routes/post/admin/moderate
 */
import {
    ContentModerationChangeInputSchema,
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
 * POST /api/v1/admin/posts/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor lacks `POST_MODERATION_CHANGE`.
 * @throws 404 if the post does not exist.
 */
export const adminModeratePostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Moderate a post (admin)',
    description:
        'Sets the post moderation state (PENDING | APPROVED | REJECTED). Does not touch ' +
        'visibility, so approving does not publish and rejecting does not unpublish. ' +
        'Requires POST_MODERATION_CHANGE.',
    tags: ['Posts', 'Admin'],
    requiredPermissions: [PermissionEnum.POST_MODERATION_CHANGE],
    requestParams: { id: PostIdSchema },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { moderationState } = ContentModerationChangeInputSchema.parse(body);

        const result = await postService.moderate({
            actor,
            id: params.id as string,
            moderationState
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
