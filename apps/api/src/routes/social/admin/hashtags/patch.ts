/**
 * Admin partial update social hashtag endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialHashtagSchema,
    SocialHashtagUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialHashtagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagService = new SocialHashtagService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/hashtags/:id
 * Partial update social hashtag — Admin endpoint.
 */
export const adminPatchSocialHashtagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social hashtag (admin)',
    description:
        'Updates specific fields of a social hashtag. normalizedHashtag is auto-recomputed when hashtag changes.',
    tags: ['Social Hashtags'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialHashtagUpdateSchema,
    responseSchema: SocialHashtagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await hashtagService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
