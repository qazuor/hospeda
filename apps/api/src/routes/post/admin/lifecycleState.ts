/**
 * Admin lifecycle-state post endpoint — HOS-374 §7.6.4.
 *
 * Moves a post through its lifecycle (DRAFT / ACTIVE / ARCHIVED) by writing
 * `lifecycleState` and nothing else.
 *
 * @module routes/post/admin/lifecycleState
 */
import {
    ContentLifecycleStateInputSchema,
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
 * POST /api/v1/admin/posts/:id/lifecycle-state
 *
 * @throws 400 if `lifecycleState` is not a valid lifecycle status.
 * @throws 403 if the actor lacks `POST_LIFECYCLE_CHANGE`.
 * @throws 404 if the post does not exist.
 */
export const adminSetPostLifecycleStateRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/lifecycle-state',
    summary: 'Set post lifecycle state (admin)',
    description:
        'Sets the post lifecycle state (DRAFT | ACTIVE | ARCHIVED). Requires ' +
        'POST_LIFECYCLE_CHANGE.',
    tags: ['Posts', 'Admin'],
    requiredPermissions: [PermissionEnum.POST_LIFECYCLE_CHANGE],
    requestParams: { id: PostIdSchema },
    requestBody: ContentLifecycleStateInputSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { lifecycleState } = ContentLifecycleStateInputSchema.parse(body);

        const result = await postService.setLifecycleState({
            actor,
            id: params.id as string,
            lifecycleState
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
