/**
 * Admin create social campaign endpoint.
 *
 * Note: `slug` is optional — the service auto-generates it from `name`
 * in `_beforeCreate` when not supplied.
 */
import { PermissionEnum, SocialCampaignCreateSchema, SocialCampaignSchema } from '@repo/schemas';
import { ServiceError, SocialCampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const campaignService = new SocialCampaignService({ logger: apiLogger });
// SocialCampaignCreateSchema already has slug optional (service auto-generates from name).

/**
 * POST /api/v1/admin/social/campaigns
 * Create social campaign — Admin endpoint.
 */
export const adminCreateSocialCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social campaign',
    description: 'Creates a new social campaign. slug is auto-generated from name if not supplied.',
    tags: ['Social Campaigns'],
    requiredPermissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE],
    requestBody: SocialCampaignCreateSchema,
    responseSchema: SocialCampaignSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await campaignService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
