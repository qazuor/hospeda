/**
 * Admin soft delete post sponsor endpoint
 * Allows admins to soft delete any post sponsor
 */
import { DeleteResultSchema, PermissionEnum, PostSponsorIdSchema } from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/post-sponsors/:id
 * Soft delete post sponsor - Admin endpoint
 */
export const adminDeletePostSponsorRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete post sponsor (admin)',
    description: 'Soft deletes a post sponsor. Admin only.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_DELETE],
    requestParams: {
        id: PostSponsorIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await postSponsorService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});
