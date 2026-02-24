/**
 * Admin restore post sponsor endpoint
 * Restores a soft-deleted post sponsor
 */
import {
    PermissionEnum,
    PostSponsorIdSchema,
    PostSponsorSchema,
    type ServiceErrorCode
} from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * POST /api/v1/admin/post-sponsors/:id/restore
 * Restore post sponsor - Admin endpoint
 */
export const adminRestorePostSponsorRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore post sponsor',
    description: 'Restores a soft-deleted post sponsor. Requires POST_SPONSOR_RESTORE permission.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_RESTORE],
    requestParams: {
        id: PostSponsorIdSchema
    },
    responseSchema: PostSponsorSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postSponsorService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
