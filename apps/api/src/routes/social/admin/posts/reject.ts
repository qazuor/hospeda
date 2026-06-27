/**
 * Admin reject social post endpoint.
 * Transitions a post in NEEDS_REVIEW/PENDING to REJECTED approval status.
 */
import {
    IdSchema,
    PermissionEnum,
    RejectSocialPostSchema,
    SocialPostApprovalResponseSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/reject
 * Reject a social post in NEEDS_REVIEW/PENDING state — Admin endpoint.
 */
export const adminRejectSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/reject',
    summary: 'Reject social post (admin)',
    description: 'Marks a social post as REJECTED and appends the rejection reason to notes.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_APPROVE],
    requestParams: { id: IdSchema },
    requestBody: RejectSocialPostSchema,
    responseSchema: SocialPostApprovalResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;
        const reason = body.reason as string;

        const result = await postService.reject({ actor, postId, reason });

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
