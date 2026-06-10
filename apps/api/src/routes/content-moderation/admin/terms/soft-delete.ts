/**
 * Admin soft delete moderation term endpoint
 */
import { DeleteResultSchema, PermissionEnum, contentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/content-moderation/terms/:id
 * Soft delete moderation term - Admin endpoint.
 */
export const adminSoftDeleteTermRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete moderation term (admin)',
    description: 'Soft deletes a content moderation term',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_DELETE],
    requestParams: { id: contentModerationTermSchema.shape.id },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const result = await termService.softDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id: params.id
        };
    }
});
