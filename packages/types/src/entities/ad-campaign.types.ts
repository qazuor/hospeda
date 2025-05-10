import type { AdminInfoType, BaseEntityType } from '../common.types';
import type { AdChannelEnum, AdPlaceEnum, CampaignStateEnum } from '../enums.types';
import type { PostSponsorType } from './post.types';

/**
 * Represents a paid advertising campaign across multiple channels and placements.
 */
export interface AdCampaignType extends BaseEntityType {
    /**
     * Internal name of the campaign.
     */
    name: string;

    /**
     * The sponsor or advertiser associated with the campaign.
     */
    sponsor: PostSponsorType;

    /**
     * Optional description or notes about the campaign's goals.
     */
    description?: string;

    /**
     * Campaign start date (when it becomes active).
     */
    startDate: Date;

    /**
     * Optional end date (when campaign should stop).
     */
    endDate?: Date;

    /**
     * Current lifecycle state of the campaign.
     */
    campaignState: CampaignStateEnum;

    /**
     * List of channels where the campaign will be active (e.g., EMAIL, PUSH).
     */
    channels: AdChannelEnum[];

    /**
     * Optional tags for reporting, filtering, or categorization.
     */
    tags?: string[];

    /**
     * Website banner placements where the campaign will be shown.
     */
    webBannerPlace?: AdPlaceEnum[];

    /**
     * ID or name of the web banner template (for visual rendering).
     */
    webBannerTemplate: string;

    /**
     * Optional list of related blog posts (referenced by slug or ID).
     */
    associatedPosts?: string[];

    /**
     * Optional list of related accommodations (IDs).
     */
    associatedAccommodations?: string[];

    /**
     * Optional list of related events (IDs).
     */
    associatedEvents?: string[];

    /**
     * Internal metadata for administrative purposes.
     */
    adminInfo?: AdminInfoType;
}
