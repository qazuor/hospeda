/**
 * Protected soft delete post endpoint
 * Requires authentication and ownership
 */
import { PermissionEnum, PostIdSchema, type ServiceErrorCode, SuccessSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/posts/:id
 * Soft delete post - Protected endpoint
 */
export const protectedSoftDeletePostRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete post',
    description: 'Soft deletes a post. Requires POST_DELETE permission.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_DELETE],
    requestParams: { id: PostIdSchema },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
