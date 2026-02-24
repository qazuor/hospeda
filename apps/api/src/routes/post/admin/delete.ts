/**
 * Admin delete (soft) post endpoint
 * Allows admins to soft delete any post
 */
import {
    DeleteResultSchema,
    PermissionEnum,
    PostIdSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/posts/:id
 * Soft delete post - Admin endpoint
 */
export const adminDeletePostRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete post (admin)',
    description: 'Soft deletes a post. Admin only.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_DELETE],
    requestParams: {
        id: PostIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await postService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
