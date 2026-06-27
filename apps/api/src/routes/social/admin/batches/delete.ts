/**
 * Admin soft-delete social content batch endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialContentBatchService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const batchService = new SocialContentBatchService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/batches/:id
 * Soft-delete social content batch — Admin endpoint.
 */
export const adminDeleteSocialBatchRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social content batch (admin)',
    description: 'Soft-deletes a social content batch. Reversible via restore.',
    tags: ['Social Batches'],
    requiredPermissions: [PermissionEnum.SOCIAL_BATCH_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await batchService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
