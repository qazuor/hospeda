/**
 * Admin restore post endpoint
 * Restores a soft-deleted post
 */
import {
    PermissionEnum,
    PostAdminSchema,
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
 * POST /api/v1/admin/posts/:id/restore
 * Restore post - Admin endpoint
 */
export const adminRestorePostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore post',
    description: 'Restores a soft-deleted post. Requires ADMIN role.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_RESTORE],
    requestParams: { id: PostIdSchema },
    responseSchema: PostAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await postService.restore(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
