import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { CampaignStatusPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';

/**
 * Campaign Target Audience Type
 * Defines the targeting criteria for a campaign
 */
export type CampaignTargetAudienceType = {
    countries?: string[];
    regions?: string[];
    cities?: string[];
    ageRange?: {
        min: number;
        max: number;
    };
    interests?: string[];
    languages?: string[];
    userSegments?: Array<
        'new_users' | 'returning_users' | 'premium_users' | 'hosts' | 'guests' | 'inactive_users'
    >;
};

/**
 * Campaign Budget Type
 * Budget and spending tracking for campaigns
 */
export type CampaignBudgetType = {
    totalBudget: number;
    dailyBudget?: number;
    spentAmount: number;
    currency: string;
    costPerAction?: number;
    bidStrategy: 'manual' | 'automatic' | 'target_cpa' | 'maximize_conversions';
};

/**
 * Campaign Schedule Type
 * Campaign scheduling information
 */
export type CampaignScheduleType = {
    startDate: Date;
    endDate?: Date;
    timezone: string;
};

/**
 * Campaign Content Type
 * Campaign content and messaging
 */
export type CampaignContentType = {
    subject: string;
    bodyTemplate: string;
    callToAction: string;
    landingPageUrl?: string;
    assets: Array<{
        type: 'image' | 'video' | 'gif' | 'document';
        url: string;
        altText?: string;
        size?: number;
    }>;
};

/**
 * Campaign Performance Type
 * Performance tracking metrics (optional)
 */
export type CampaignPerformanceType = {
    impressions: number;
    clicks: number;
    conversions: number;
    clickThroughRate: number;
    conversionRate: number;
    costPerClick: number;
    costPerConversion: number;
    returnOnAdSpend: number;
};

/**
 * Campaign Settings Type
 * Campaign configuration settings (optional)
 */
export type CampaignSettingsType = {
    priority: number;
    isTestCampaign: boolean;
    allowOptOut: boolean;
    trackingEnabled: boolean;
    notes?: string;
    tags: string[];
};

/**
 * Campaigns Table
 * Marketing campaigns with budget management, audience targeting, and multi-channel delivery
 */
export const campaigns = pgTable('campaigns', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Basic campaign information
    name: text('name').notNull(),
    description: text('description').notNull(),
    status: CampaignStatusPgEnum('status').notNull(),

    // Campaign channels (stored as array of enum strings)
    channels: jsonb('channels').$type<string[]>().notNull(),

    // Audience targeting
    targetAudience: jsonb('target_audience').$type<CampaignTargetAudienceType>().notNull(),

    // Budget and spending
    budget: jsonb('budget').$type<CampaignBudgetType>().notNull(),

    // Campaign scheduling
    schedule: jsonb('schedule').$type<CampaignScheduleType>().notNull(),

    // Campaign content and messaging
    content: jsonb('content').$type<CampaignContentType>().notNull(),

    // Performance tracking (optional)
    performance: jsonb('performance').$type<CampaignPerformanceType>(),

    // Campaign settings (optional)
    settings: jsonb('settings').$type<CampaignSettingsType>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Admin metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>()
});

export const campaignRelations = relations(campaigns, ({ one }) => ({
    // Parent relations
    client: one(clients, {
        fields: [campaigns.clientId],
        references: [clients.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [campaigns.createdById],
        references: [users.id],
        relationName: 'campaign_created_by'
    }),
    updatedBy: one(users, {
        fields: [campaigns.updatedById],
        references: [users.id],
        relationName: 'campaign_updated_by'
    }),
    deletedBy: one(users, {
        fields: [campaigns.deletedById],
        references: [users.id],
        relationName: 'campaign_deleted_by'
    })
}));
