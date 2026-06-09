/**
 * Admin patch moderation term endpoint (partial update)
 */
import {
    PermissionEnum,
    contentModerationTermSchema,
    updateContentModerationTermSchema
} from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * PATCH /api/v1/admin/content-moderation/terms/:id
 * Patch moderation term - Admin endpoint.
 */
export const adminPatchTermRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch moderation term (admin)',
    description: 'Partially updates a content moderation term',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_UPDATE],
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
