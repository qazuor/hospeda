/**
 * Admin create social content batch endpoint.
 *
 * Note: `slug` is optional — the service auto-generates it from `name`
 * in `_beforeCreate` when not supplied.
 */
import {
    PermissionEnum,
    SocialContentBatchCreateSchema,
    SocialContentBatchSchema
} from '@repo/schemas';
import { ServiceError, SocialContentBatchService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const batchService = new SocialContentBatchService({ logger: apiLogger });
// SocialContentBatchCreateSchema already has slug optional (service auto-generates from name).

/**
 * POST /api/v1/admin/social/batches
 * Create social content batch — Admin endpoint.
 */
export const adminCreateSocialBatchRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social content batch',
    description:
        'Creates a new social content batch. slug is auto-generated from name if not supplied.',
    tags: ['Social Batches'],
    requiredPermissions: [PermissionEnum.SOCIAL_BATCH_MANAGE],
    requestBody: SocialContentBatchCreateSchema,
    responseSchema: SocialContentBatchSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await batchService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
