/**
 * Admin get social campaign by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialCampaignSchema } from '@repo/schemas';
import { ServiceError, SocialCampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const campaignService = new SocialCampaignService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/campaigns/:id
 * Get social campaign by ID — Admin endpoint.
 */
export const adminGetSocialCampaignByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social campaign by ID (admin)',
    description: 'Retrieves a social campaign by ID',
    tags: ['Social Campaigns'],
    requiredPermissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: SocialCampaignSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await campaignService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
