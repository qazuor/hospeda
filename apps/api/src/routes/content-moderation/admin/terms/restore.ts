/**
 * Admin restore moderation term endpoint
 */
import { contentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const termService = new ContentModerationTermService({ logger: apiLogger });

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
    requestParams: { id: contentModerationTermSchema.shape.id },
    responseSchema: contentModerationTermSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await termService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
