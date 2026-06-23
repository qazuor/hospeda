/**
 * Admin get social hashtag by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialHashtagSchema } from '@repo/schemas';
import { ServiceError, SocialHashtagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagService = new SocialHashtagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/hashtags/:id
 * Get social hashtag by ID — Admin endpoint.
 */
export const adminGetSocialHashtagByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social hashtag by ID (admin)',
    description: 'Retrieves full social hashtag information by ID',
    tags: ['Social Hashtags'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_VIEW],
    requestParams: { id: IdSchema },
    responseSchema: SocialHashtagSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await hashtagService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
