/**
 * Admin partial update social content batch endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialContentBatchSchema,
    SocialContentBatchUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialContentBatchService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const batchService = new SocialContentBatchService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/batches/:id
 * Partial update social content batch — Admin endpoint.
 */
export const adminPatchSocialBatchRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social content batch (admin)',
    description: 'Updates specific fields of a social content batch.',
    tags: ['Social Batches'],
    requiredPermissions: [PermissionEnum.SOCIAL_BATCH_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialContentBatchUpdateSchema,
    responseSchema: SocialContentBatchSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await batchService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
