/**
 * Admin mark-ready social post endpoint.
 * Marks an APPROVED post as READY_TO_PUBLISH for immediate dispatch.
 */
import { IdSchema, PermissionEnum, SocialPostStatusResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/mark-ready
 * Mark an approved social post as READY_TO_PUBLISH — Admin endpoint.
 */
export const adminMarkReadySocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/mark-ready',
    summary: 'Mark social post ready to publish (admin)',
    description: 'Transitions an APPROVED social post to READY_TO_PUBLISH for immediate dispatch.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_SCHEDULE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostStatusResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.markReady({ actor, postId });

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
