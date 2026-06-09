/**
 * Admin get moderation term by ID endpoint
 */
import { PermissionEnum, contentModerationTermSchema } from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/admin/content-moderation/terms/:id
 * Get moderation term by ID - Admin endpoint.
 */
export const adminGetTermByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get moderation term by ID (admin)',
    description: 'Retrieves a content moderation term by its ID',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_VIEW],
    requestParams: { id: contentModerationTermSchema.shape.id },
    responseSchema: contentModerationTermSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const result = await termService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    }
});
