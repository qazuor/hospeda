/**
 * Admin hard delete tag endpoint
 * Permanently deletes a tag
 */
import { PermissionEnum, type ServiceErrorCode, TagIdSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/tags/:id/hard
 * Hard delete tag - Admin endpoint
 */
export const adminHardDeleteTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete tag',
    description: 'Permanently deletes a tag. Requires TAG_DELETE permission.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_DELETE],
    requestParams: {
        id: TagIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await tagService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Tag permanently deleted'
        };
    }
});
