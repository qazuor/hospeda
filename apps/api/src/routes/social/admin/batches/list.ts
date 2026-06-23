/**
 * Admin list social content batches endpoint.
 */
import {
    PermissionEnum,
    SocialContentBatchAdminSearchSchema,
    SocialContentBatchSchema
} from '@repo/schemas';
import { ServiceError, SocialContentBatchService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const batchService = new SocialContentBatchService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/batches
 * List all social content batches — Admin endpoint (includes deleted).
 */
export const adminListSocialBatchesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social content batches (admin)',
    description: 'Returns a paginated list of all social content batches including deleted ones',
    tags: ['Social Batches'],
    requiredPermissions: [PermissionEnum.SOCIAL_BATCH_MANAGE],
    requestQuery: SocialContentBatchAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialContentBatchSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await batchService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
