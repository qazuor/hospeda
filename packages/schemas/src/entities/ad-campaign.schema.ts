import { z } from 'zod';
import { AdminInfoSchema, BaseEntitySchema } from '../common.schema';
import { AdChannelEnumSchema, AdPlaceEnumSchema, CampaignStateEnumSchema } from '../enums.schema';
import { PostSponsorSchema } from './post.schema';

/**
 * Schema for a full advertising campaign definition.
 */
export const AdCampaignSchema = BaseEntitySchema.extend({
    /**
     * Internal name of the campaign.
     */
    name: z.string().min(1, {
        message: 'error:adCampaign.nameRequired'
    }),

    /**
     * Sponsor or advertiser entity.
     */
    sponsor: PostSponsorSchema,

    /**
     * Optional campaign description or internal notes.
     */
    description: z.string().optional(),

    /**
     * Campaign start date.
     */
    startDate: z.date(),

    /**
     * Optional end date.
     */
    endDate: z.date().optional(),

    /**
     * Lifecycle status of the campaign.
     */
    campaignState: CampaignStateEnumSchema,

    /**
     * List of active channels for delivery (e.g., EMAIL, PUSH).
     */
    channels: z.array(AdChannelEnumSchema).min(1, {
        message: 'error:adCampaign.channelsRequired'
    }),

    /**
     * Optional tags for classification or filtering.
     */
    tags: z.array(z.string()).optional(),

    /**
     * Optional banner placements on the platform (homepage, blog, etc.).
     */
    webBannerPlace: z.array(AdPlaceEnumSchema).optional(),

    /**
     * Reference to a web banner template (design, layout).
     */
    webBannerTemplate: z.string().min(1, {
        message: 'error:adCampaign.templateRequired'
    }),

    /**
     * List of post slugs or IDs linked to this campaign.
     */
    associatedPosts: z.array(z.string()).optional(),

    /**
     * Accommodation IDs tied to the campaign.
     */
    associatedAccommodations: z.array(z.string().uuid()).optional(),

    /**
     * Event IDs tied to the campaign.
     */
    associatedEvents: z.array(z.string().uuid()).optional(),

    /**
     * Admin notes and flags.
     */
    adminInfo: AdminInfoSchema.optional()
});
