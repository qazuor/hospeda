/**
 * Admin soft-delete social post footer endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialPostFooterService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const footerService = new SocialPostFooterService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/footers/:id
 * Soft-delete social post footer — Admin endpoint.
 */
export const adminDeleteSocialFooterRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social post footer (admin)',
    description: 'Soft-deletes a social post footer. Reversible via restore.',
    tags: ['Social Footers'],
    requiredPermissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await footerService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
