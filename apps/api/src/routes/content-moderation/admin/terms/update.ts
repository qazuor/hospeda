/**
 * Admin update moderation term endpoint (full update)
 */
import { contentModerationTermSchema, updateContentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * PUT /api/v1/admin/content-moderation/terms/:id
 * Update moderation term - Admin endpoint.
 */
export const adminUpdateTermRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update moderation term (admin)',
    description: 'Updates an existing content moderation term',
    tags: ['Content Moderation'],
    requestParams: { id: contentModerationTermSchema.shape.id },
    requestBody: updateContentModerationTermSchema,
    responseSchema: contentModerationTermSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const result = await termService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
