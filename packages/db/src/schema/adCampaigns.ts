import { CampaignStateEnum, StateEnum } from '@repo/types';
import { date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';

/**
 * Table: ad_campaigns
 * Stores metadata and targeting info for sponsored marketing campaigns.
 */
export const adCampaigns = pgTable('ad_campaigns', {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * General information
     */
    name: text('name').notNull(),
    sponsor: jsonb('sponsor').notNull(), // PostSponsorType
    description: text('description'),

    /**
     * Campaign scheduling and state
     */
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    campaignState: text('campaignState', { enum: enumToTuple(CampaignStateEnum) }).notNull(),

    /**
     * Distribution channels and placements
     */
    channels: jsonb('channels').notNull(), // AdChannelEnum[]
    webBannerPlace: jsonb('web_banner_place'), // AdPlaceEnum[]
    webBannerTemplate: text('web_banner_template').notNull(),

    /**
     * Associations to other entities
     */
    associatedPosts: jsonb('associated_posts'), // string[] of post IDs or slugs
    associatedAccommodations: jsonb('associated_accommodations'), // string[] of IDs
    associatedEvents: jsonb('associated_events'), // string[] of IDs

    /**
     * Metadata and control
     */
    tags: jsonb('tags').default([]),
    adminInfo: jsonb('admin_info'),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});
