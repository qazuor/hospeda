/**
 * Protected moderate post endpoint — HOS-1037.
 *
 * The trusted editor's self-approve switch: raises `moderationState` to
 * `APPROVED` on a post they authored, without touching `visibility`. Before
 * this route existed, "Editor de confianza" granted `POST_PUBLISH_OWN` and
 * `POST_DELETE_OWN` but nothing could ever clear a post out of `PENDING` —
 * `visibility` was already `PUBLIC` from creation, so the only control the
 * author had (the publish-state toggle) moved a value that was never the
 * blocker.
 *
 * Authorization lives entirely in `PostService.moderate()` /
 * `checkCanModeratePost()`, which accepts either `POST_MODERATION_CHANGE`
 * (the admin queue, any post, any verdict) or authorship plus
 * `POST_PUBLISH_OWN` when the requested verdict is `APPROVED`. A trusted
 * editor may approve their own content but may not self-reject or push it
 * back to `PENDING` — those stay platform-only, same as before. The route
 * declares no `requiredPermissions` because the author-scoped half of that
 * rule cannot be expressed without the post, and `PostService.moderate()`
 * masks a foreign-row refusal into 404 so this route never confirms that a
 * post belonging to someone else exists.
 *
 * @module routes/post/protected/moderate
 */
import {
    ContentModerationChangeInputSchema,
    PostIdSchema,
    PostProtectedSchema
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * POST /api/v1/protected/posts/:id/moderate
 *
 * @throws 400 if `moderationState` is not a valid moderation status.
 * @throws 403 if the actor is the author but lacks `POST_PUBLISH_OWN`, or
 *         requests a verdict other than `APPROVED`.
 * @throws 404 if the post does not exist, or belongs to another author.
 */
export const protectedModeratePostRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/moderate',
    summary: 'Approve own post (trusted editor)',
    description:
        'Sets the moderation state of a post the actor authored. Requires POST_PUBLISH_OWN ' +
        '(or POST_MODERATION_CHANGE for any post/verdict). The author path only accepts ' +
        'APPROVED. Leaves visibility intact.',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    requestBody: ContentModerationChangeInputSchema,
    responseSchema: PostProtectedSchema,
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
