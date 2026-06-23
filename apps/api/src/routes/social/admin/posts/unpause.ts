/**
 * Admin unpause social post endpoint.
 * Unpauses a previously paused post, allowing dispatch to resume.
 */
import { IdSchema, PermissionEnum, SocialPostPauseResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/unpause
 * Unpause a previously paused social post — Admin endpoint.
 */
export const adminUnpauseSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/unpause',
    summary: 'Unpause social post (admin)',
    description: 'Unpauses a social post, allowing the dispatch cron to resume publishing it.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_PAUSE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostPauseResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.unpause({ actor, postId });

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
