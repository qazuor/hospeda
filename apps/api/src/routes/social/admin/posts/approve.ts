/**
 * Admin approve social post endpoint.
 * Transitions a post from NEEDS_REVIEW to APPROVED.
 */
import { IdSchema, PermissionEnum, SocialPostApprovalResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/approve
 * Approve a social post in NEEDS_REVIEW state — Admin endpoint.
 */
export const adminApproveSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/approve',
    summary: 'Approve social post (admin)',
    description: 'Transitions a social post from NEEDS_REVIEW to APPROVED.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_APPROVE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostApprovalResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.approve({ actor, postId });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return result.data;
    }
});
