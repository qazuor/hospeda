/**
 * Admin soft-delete social hashtag set endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialHashtagSetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagSetService = new SocialHashtagSetService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/hashtag-sets/:id
 * Soft-delete social hashtag set — Admin endpoint.
 */
export const adminDeleteSocialHashtagSetRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social hashtag set (admin)',
    description: 'Soft-deletes a social hashtag set. Reversible via restore.',
    tags: ['Social Hashtag Sets'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await hashtagSetService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
