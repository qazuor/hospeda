/**
 * Admin restore tag endpoint
 * Restores a soft-deleted tag
 */
import { PermissionEnum, type ServiceErrorCode, TagIdSchema, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * POST /api/v1/admin/tags/:id/restore
 * Restore tag - Admin endpoint
 */
export const adminRestoreTagRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore tag',
    description: 'Restores a soft-deleted tag. Requires TAG_DELETE permission.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_DELETE],
    requestParams: {
        id: TagIdSchema
    },
    responseSchema: TagSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await tagService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
