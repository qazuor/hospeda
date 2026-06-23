/**
 * Admin request-changes social post endpoint.
 * Sets a post's approvalStatus to CHANGES_REQUESTED while keeping it in NEEDS_REVIEW.
 */
import {
    IdSchema,
    PermissionEnum,
    RequestChangesSocialPostSchema,
    SocialPostApprovalResponseSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/request-changes
 * Request editorial changes on a social post in NEEDS_REVIEW/PENDING state — Admin endpoint.
 */
export const adminRequestChangesSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/request-changes',
    summary: 'Request changes on social post (admin)',
    description: 'Sets a social post approval status to CHANGES_REQUESTED and appends feedback.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_APPROVE],
    requestParams: { id: IdSchema },
    requestBody: RequestChangesSocialPostSchema,
    responseSchema: SocialPostApprovalResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;
        const feedback = body.feedback as string;

        const result = await postService.requestChanges({ actor, postId, feedback });

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
