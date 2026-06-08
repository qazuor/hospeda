/**
 * Admin hard delete moderation term endpoint
 */
import { DeleteResultSchema, contentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const termService = new ContentModerationTermService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/content-moderation/terms/:id/hard
 * Hard delete moderation term - Admin endpoint.
 */
export const adminHardDeleteTermRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete moderation term (admin)',
    description: 'Permanently deletes a content moderation term',
    tags: ['Content Moderation'],
    requestParams: { id: contentModerationTermSchema.shape.id },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await termService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id: params.id
        };
    }
});
