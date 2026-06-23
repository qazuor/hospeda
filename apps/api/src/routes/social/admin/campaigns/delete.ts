/**
 * Admin soft-delete social campaign endpoint.
 */
import { DeleteResultSchema, IdSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError, SocialCampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const campaignService = new SocialCampaignService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/social/campaigns/:id
 * Soft-delete social campaign — Admin endpoint.
 */
export const adminDeleteSocialCampaignRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete social campaign (admin)',
    description: 'Soft-deletes a social campaign. Reversible via restore.',
    tags: ['Social Campaigns'],
    requiredPermissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await campaignService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: (result.data?.count ?? 0) > 0,
            id
        };
    }
});
