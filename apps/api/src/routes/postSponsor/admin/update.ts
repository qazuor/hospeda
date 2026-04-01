/**
 * Admin update post sponsor endpoint
 * Allows admins to update any post sponsor
 */
import {
    PermissionEnum,
    PostSponsorAdminSchema,
    PostSponsorIdSchema,
    PostSponsorUpdateInputSchema
} from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/post-sponsors/:id
 * Update post sponsor - Admin endpoint
 */
export const adminUpdatePostSponsorRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update post sponsor (admin)',
    description: 'Updates any post sponsor. Admin only.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_UPDATE],
    requestParams: {
        id: PostSponsorIdSchema
    },
    requestBody: PostSponsorUpdateInputSchema,
    responseSchema: PostSponsorAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const result = await postSponsorService.update(actor, id as string, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
