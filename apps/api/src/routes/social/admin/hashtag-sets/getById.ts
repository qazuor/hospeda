/**
 * Admin get social hashtag set by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialHashtagSetSchema } from '@repo/schemas';
import { ServiceError, SocialHashtagSetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagSetService = new SocialHashtagSetService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/hashtag-sets/:id
 * Get social hashtag set by ID — Admin endpoint.
 */
export const adminGetSocialHashtagSetByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social hashtag set by ID (admin)',
    description: 'Retrieves a social hashtag set by ID',
    tags: ['Social Hashtag Sets'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: SocialHashtagSetSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await hashtagSetService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
