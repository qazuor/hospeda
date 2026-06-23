/**
 * Admin pause social post endpoint.
 * Pauses a post to prevent the dispatch cron from publishing it.
 */
import { IdSchema, PermissionEnum, SocialPostPauseResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/pause
 * Pause a social post — Admin endpoint.
 */
export const adminPauseSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/pause',
    summary: 'Pause social post (admin)',
    description:
        'Pauses a social post to prevent dispatch. Cannot pause PUBLISHED or FAILED posts.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_PAUSE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostPauseResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.pause({ actor, postId });

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
