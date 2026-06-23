/**
 * Admin list social campaigns endpoint.
 */
import {
    PermissionEnum,
    SocialCampaignAdminSearchSchema,
    SocialCampaignSchema
} from '@repo/schemas';
import { ServiceError, SocialCampaignService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const campaignService = new SocialCampaignService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/campaigns
 * List all social campaigns — Admin endpoint (includes deleted).
 */
export const adminListSocialCampaignsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all social campaigns (admin)',
    description: 'Returns a paginated list of all social campaigns including deleted ones',
    tags: ['Social Campaigns'],
    requiredPermissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE],
    requestQuery: SocialCampaignAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialCampaignSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await campaignService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
