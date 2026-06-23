import { BaseModelImpl } from '../../base/base.model.ts';
import { socialCampaigns } from '../../schemas/social/social_campaigns.dbschema.ts';

/** Row type inferred from the social_campaigns table */
type SelectSocialCampaign = typeof socialCampaigns.$inferSelect;

/**
 * Model for the `social_campaigns` table.
 * Groups social posts under a named content campaign.
 * Supports soft-delete via `deletedAt`.
 */
export class SocialCampaignModel extends BaseModelImpl<SelectSocialCampaign> {
    protected table = socialCampaigns;
    public entityName = 'social_campaigns';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'posts'
    ] as const;

    protected getTableName(): string {
        return 'socialCampaigns';
    }
}

/** Singleton instance of SocialCampaignModel for use across the application. */
export const socialCampaignModel = new SocialCampaignModel();
