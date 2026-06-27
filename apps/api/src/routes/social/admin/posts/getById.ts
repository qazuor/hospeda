/**
 * Admin get social post by ID endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/posts/{id}
 * Returns full detail of a single social post, including related targets, media,
 * resolved hashtags, and last 10 publish logs.
 */
import { IdSchema, PermissionEnum, SocialPostDetailSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/posts/:id
 * Get social post by ID — Admin endpoint.
 * Returns a full detail object with related targets, media, hashtags, and publish logs.
 */
export const adminGetSocialPostByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social post by ID (admin)',
    description:
        'Returns the full detail of a social post, including related targets, ' +
        'media assets (with Cloudinary URLs), resolved hashtag text, and the ' +
        'last 10 publish log entries (newest first).',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_VIEW],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostDetailSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getPostDetail({
            actor,
            postId: params.id as string
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
