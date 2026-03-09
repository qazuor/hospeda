/**
 * Admin soft delete tag endpoint
 * Soft deletes a tag
 */
import { DeleteResultSchema, PermissionEnum, TagIdSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/tags/:id
 * Soft delete tag - Admin endpoint
 */
export const adminDeleteTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete tag (admin)',
    description: 'Soft deletes a tag. Admin only.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_DELETE],
    requestParams: {
        id: TagIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await tagService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
