/**
 * Admin hard delete post endpoint
 * Permanently deletes a post from database
 */
import { PermissionEnum, PostIdSchema, SuccessSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/posts/:id/hard
 * Hard delete post - Admin endpoint
 */
export const adminHardDeletePostRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete post',
    description: 'Permanently deletes a post. Requires ADMIN role.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_HARD_DELETE],
    requestParams: { id: PostIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const postService = new PostService({ logger: apiLogger }, undefined, getMediaProvider());
        const result = await postService.hardDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
