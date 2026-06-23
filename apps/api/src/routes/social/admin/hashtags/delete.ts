/**
 * Admin soft-delete social hashtag endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialHashtagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagService = new SocialHashtagService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/hashtags/:id
 * Soft-delete social hashtag — Admin endpoint.
 */
export const adminDeleteSocialHashtagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social hashtag (admin)',
    description: 'Soft-deletes a social hashtag. Reversible via restore.',
    tags: ['Social Hashtags'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await hashtagService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
