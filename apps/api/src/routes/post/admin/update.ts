/**
 * Admin update post endpoint
 * Allows admins to update any post
 */
import {
    PermissionEnum,
    PostAdminSchema,
    PostIdSchema,
    type PostUpdateInput,
    PostUpdateInputSchema
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/posts/:id
 * Update post - Admin endpoint
 */
export const adminUpdatePostRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update post (admin)',
    description: 'Updates any post. Admin only.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_UPDATE],
    requestParams: {
        id: PostIdSchema
    },
    requestBody: PostUpdateInputSchema,
    responseSchema: PostAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as PostUpdateInput;

        const result = await postService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
