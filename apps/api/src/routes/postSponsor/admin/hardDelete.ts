/**
 * Admin hard delete post sponsor endpoint
 * Permanently deletes a post sponsor
 */
import { PermissionEnum, PostSponsorIdSchema } from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/post-sponsors/:id/hard
 * Hard delete post sponsor - Admin endpoint
 */
export const adminHardDeletePostSponsorRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete post sponsor',
    description:
        'Permanently deletes a post sponsor. Requires POST_SPONSOR_HARD_DELETE permission.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_HARD_DELETE],
    requestParams: {
        id: PostSponsorIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postSponsorService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Post sponsor permanently deleted'
        };
    }
});
