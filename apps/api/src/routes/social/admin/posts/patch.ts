/**
 * Admin partial-update social post endpoint — SPEC-254 T-037.
 *
 * PATCH /api/v1/admin/social/posts/{id}
 * Updates whitelisted content fields of a social post.
 * Status, approvalStatus, paused, and audit/soft-delete fields are stripped by the service.
 */
import { IdSchema, PermissionEnum, SocialPostSchema, SocialPostUpdateSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { UpdatePostData } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/posts/:id
 * Partial update social post — Admin endpoint.
 * Only whitelisted content fields are accepted; state fields are silently stripped.
 */
export const adminPatchSocialPostRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social post (admin)',
    description:
        'Updates whitelisted content fields of a social post: ' +
        'title, captionBase, finalCaption, finalHashtagsText, notes, internalNotes, ' +
        'footerId, campaignId, batchId, audienceId, batchPosition. ' +
        'Pipeline state fields (status, approvalStatus, paused) are never updated via this route.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_UPDATE],
    requestParams: { id: IdSchema },
    requestBody: SocialPostUpdateSchema,
    responseSchema: SocialPostSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.updatePost({
            actor,
            postId: params.id as string,
            data: body as UpdatePostData
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
