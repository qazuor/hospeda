/**
 * Admin get social content batch by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialContentBatchSchema } from '@repo/schemas';
import { ServiceError, SocialContentBatchService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const batchService = new SocialContentBatchService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/batches/:id
 * Get social content batch by ID — Admin endpoint.
 */
export const adminGetSocialBatchByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social content batch by ID (admin)',
    description: 'Retrieves a social content batch by ID',
    tags: ['Social Batches'],
    requiredPermissions: [PermissionEnum.SOCIAL_BATCH_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: SocialContentBatchSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await batchService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
