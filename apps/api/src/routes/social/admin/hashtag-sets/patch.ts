/**
 * Admin partial update social hashtag set endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialHashtagSetSchema,
    SocialHashtagSetUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialHashtagSetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagSetService = new SocialHashtagSetService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/hashtag-sets/:id
 * Partial update social hashtag set — Admin endpoint.
 */
export const adminPatchSocialHashtagSetRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social hashtag set (admin)',
    description: 'Updates specific fields of a social hashtag set.',
    tags: ['Social Hashtag Sets'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialHashtagSetUpdateSchema,
    responseSchema: SocialHashtagSetSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await hashtagSetService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
