/**
 * Admin restore moderation term endpoint
 */
import { PermissionEnum, contentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/admin/content-moderation/terms/:id/restore
 * Restore moderation term - Admin endpoint.
 */
export const adminRestoreTermRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore moderation term (admin)',
    description: 'Restores a soft-deleted content moderation term',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_RESTORE],
    requestParams: { id: contentModerationTermSchema.shape.id },
    responseSchema: contentModerationTermSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await termService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await termService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});
