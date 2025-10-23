import type { AdminInfoType } from '@repo/schemas';
import { CampaignChannelEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { decimal, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { adSlots } from '../campaign/adSlot.dbschema.js';
import { users } from '../user/user.dbschema.js';

// Enum for campaign channels in database
export const campaignChannelEnum = pgEnum('campaign_channel', [
    CampaignChannelEnum.WEB,
    CampaignChannelEnum.SOCIAL
]);

/**
 * AD_PRICING_CATALOG Schema - Etapa 2.4: Grupo Facturación y Pagos
 * Pricing catalog for advertising slots with channel-specific pricing
 */
export const adPricingCatalog = pgTable('ad_pricing_catalog', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Ad slot relationship (required)
    adSlotId: uuid('ad_slot_id')
        .references(() => adSlots.id, { onDelete: 'cascade' })
        .notNull(),

    // Channel-specific pricing
    channel: campaignChannelEnum('channel').notNull(),

    // Pricing structure
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),

    // Pricing model
    pricingModel: text('pricing_model').notNull().default('CPM'), // CPM, CPC, FLAT, etc.

    // Time-based pricing
    dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
    weeklyRate: decimal('weekly_rate', { precision: 10, scale: 2 }),
    monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),

    // Premium multipliers
    weekendMultiplier: decimal('weekend_multiplier', { precision: 3, scale: 2 }).default('1.00'),
    holidayMultiplier: decimal('holiday_multiplier', { precision: 3, scale: 2 }).default('1.00'),

    // Minimum and maximum constraints
    minimumBudget: decimal('minimum_budget', { precision: 10, scale: 2 }),
    maximumBudget: decimal('maximum_budget', { precision: 10, scale: 2 }),

    // Availability and scheduling
    availableFrom: timestamp('available_from', { withTimezone: true }),
    availableUntil: timestamp('available_until', { withTimezone: true }),

    // Pricing metadata and configuration
    pricingConfig: jsonb('pricing_config').$type<{
        // Dynamic pricing options
        demandMultiplier?: number;
        seasonalMultipliers?: Record<string, number>;
        // Audience targeting surcharges
        audienceTargetingRates?: Record<string, number>;
        // Geographic pricing
        geographicMultipliers?: Record<string, number>;
        // Custom pricing rules
        customRules?: Array<{
            condition: string;
            multiplier: number;
            description: string;
        }>;
    }>(),

    // Catalog metadata
    description: text('description'),
    isActive: text('is_active').notNull().default('true'),

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

export const adPricingCatalogRelations = relations(adPricingCatalog, ({ one }) => ({
    // Ad slot relationship
    adSlot: one(adSlots, {
        fields: [adPricingCatalog.adSlotId],
        references: [adSlots.id]
    }),

    // User relationships for audit
    createdBy: one(users, {
        fields: [adPricingCatalog.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [adPricingCatalog.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [adPricingCatalog.deletedById],
        references: [users.id]
    })
}));
