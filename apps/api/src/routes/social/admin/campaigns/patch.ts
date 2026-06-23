/**
 * Admin partial update social campaign endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialCampaignSchema,
    SocialCampaignUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialCampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const campaignService = new SocialCampaignService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/campaigns/:id
 * Partial update social campaign — Admin endpoint.
 */
export const adminPatchSocialCampaignRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social campaign (admin)',
    description: 'Updates specific fields of a social campaign.',
    tags: ['Social Campaigns'],
    requiredPermissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialCampaignUpdateSchema,
    responseSchema: SocialCampaignSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await campaignService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
