/**
 * Admin restore post sponsor endpoint
 * Restores a soft-deleted post sponsor
 */
import { PermissionEnum, PostSponsorAdminSchema, PostSponsorIdSchema } from '@repo/schemas';
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
    responseSchema: PostSponsorAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await postSponsorService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await postSponsorService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
