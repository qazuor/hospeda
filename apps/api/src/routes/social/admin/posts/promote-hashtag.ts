/**
 * Admin promote-hashtag social post endpoint.
 * Promotes a hashtag to the catalog and links it to the specified post.
 * Returns HTTP 201 when a new hashtag was created, 200 when an existing one was reused.
 */
import {
    IdSchema,
    PermissionEnum,
    PromoteHashtagResponseSchema,
    PromoteHashtagSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/promote-hashtag
 * Promote a hashtag to the catalog and link it to a social post — Admin endpoint.
 *
 * The `successStatusCode` option is set to 201 here because the route factory
 * supports only a STATIC success status. Dynamic 201-vs-200 based on `isNew` is
 * not supported by the factory without bypassing it entirely.
 *
 * Decision: use 201 as the fixed status code and document the limitation here.
 * The `isNew` flag in the response body allows clients to distinguish creation
 * vs. reuse without relying on the HTTP status code alone.
 *
 * Limitation: when `isNew = false` (existing hashtag reused) the response still
 * carries HTTP 201 instead of the spec-preferred 200. This is a known deviation
 * caused by the factory's single-status design. The `isNew` field in the body
 * provides the authoritative signal for clients. T-037 may address this by
 * switching to a raw Hono handler when dynamic status is required.
 */
export const adminPromoteHashtagSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/promote-hashtag',
    summary: 'Promote hashtag and link to social post (admin)',
    description:
        'Promotes a hashtag to the social hashtag catalog and links it to the post. ' +
        'Returns 201 when a new hashtag was created; body.isNew=false indicates an existing hashtag was reused.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: PromoteHashtagSchema,
    responseSchema: PromoteHashtagResponseSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;

        const result = await postService.promoteHashtag({
            actor,
            postId,
            hashtag: body.hashtag as string,
            category: body.category as string,
            platform: body.platform as string | undefined,
            audienceId: body.audienceId as string | undefined,
            priority: body.priority as number | undefined
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
