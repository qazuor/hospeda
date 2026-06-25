/**
 * Admin set-hashtags social post endpoint — SPEC-254.
 *
 * PUT /api/v1/admin/social/posts/{id}/hashtags
 * Replaces the full hashtag set of a social post with the provided ordered list.
 * Uses the social_hashtags catalog as the source of truth: hashtags not yet in the
 * catalog are created automatically (category = 'general', active = true).
 */
import {
    IdSchema,
    PermissionEnum,
    SetPostHashtagsResponseSchema,
    SocialPostSetHashtagsSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/social/posts/:id/hashtags
 * Replace the full hashtag set of a social post — Admin endpoint.
 *
 * Accepts an ordered array of hashtag strings (with or without `#` prefix).
 * Reconciles `social_post_hashtags` so the final set is exactly what was provided,
 * regenerates `finalHashtagsText`, and emits a POST_HASHTAGS_UPDATED audit log.
 *
 * Permission required: SOCIAL_POST_UPDATE.
 */
export const adminSetHashtagsSocialPostRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/hashtags',
    summary: 'Set hashtags of a social post (admin)',
    description:
        'Replaces the full hashtag set of a social post with the provided ordered list. ' +
        'Hashtags not yet in the catalog are created automatically (category = general). ' +
        'The post finalHashtagsText is regenerated and persisted.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_UPDATE],
    requestParams: { id: IdSchema },
    requestBody: SocialPostSetHashtagsSchema,
    responseSchema: SetPostHashtagsResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;
        const hashtags = body.hashtags as string[];

        const result = await postService.setPostHashtags({
            actor,
            postId,
            hashtags
        });

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
