/**
 * Admin soft-delete social audience endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialAudienceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const audienceService = new SocialAudienceService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/audiences/:id
 * Soft-delete social audience — Admin endpoint.
 */
export const adminDeleteSocialAudienceRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social audience (admin)',
    description: 'Soft-deletes a social audience. Reversible via restore.',
    tags: ['Social Audiences'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await audienceService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
