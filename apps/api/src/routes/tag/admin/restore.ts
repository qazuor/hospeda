/**
 * Admin restore tag endpoint
 * Restores a soft-deleted tag
 */
import { PermissionEnum, TagAdminSchema, TagIdSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

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
    responseSchema: TagAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await tagService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
