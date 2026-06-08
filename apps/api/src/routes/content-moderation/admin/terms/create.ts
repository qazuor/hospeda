/**
 * Admin create moderation term endpoint
 */
import {
    PermissionEnum,
    contentModerationTermSchema,
    createContentModerationTermSchema
} from '@repo/schemas';
import { ContentModerationTermService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * POST /api/v1/admin/content-moderation/terms
 * Create moderation term - Admin endpoint.
 */
export const adminCreateTermRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create moderation term',
    description: 'Creates a new content moderation term. Admin only.',
    tags: ['Content Moderation'],
    requiredPermissions: [PermissionEnum.MODERATION_TERM_CREATE],
    requestBody: createContentModerationTermSchema,
    responseSchema: contentModerationTermSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const termService = new ContentModerationTermService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const data = body as z.infer<typeof createContentModerationTermSchema>;
        const result = await termService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
