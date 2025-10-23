import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { serviceListings } from './serviceListing.dbschema';

/**
 * SERVICE_LISTING_PLAN Schema - Etapa 2.11: Grupo Listados de Servicios
 * Plans that define the limits and features for service listings
 */
export const serviceListingPlans = pgTable('service_listing_plans', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Plan details
    name: text('name').notNull(),
    description: text('description'),

    // Pricing
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),

    // Plan limits and features (JSONB for flexibility)
    limits: jsonb('limits').$type<{
        maxListings?: number;
        maxPhotos?: number;
        maxVideos?: number;
        maxFeaturedDays?: number;
        maxDescriptionLength?: number;
        allowPremiumFeatures?: boolean;
        allowAnalytics?: boolean;
        allowCustomPricing?: boolean;
        allowMultiLanguage?: boolean;
        allowCustomBranding?: boolean;
        allowBookingIntegration?: boolean;
        allowTrialPeriods?: boolean;
        maxTrialDays?: number;
        supportLevel?: 'basic' | 'standard' | 'premium';
        refreshInterval?: number; // days
        features?: string[];
    }>(),

    // Plan status
    isActive: boolean('is_active').notNull().default(true),
    isTrialAvailable: boolean('is_trial_available').notNull().default(false),
    trialDays: numeric('trial_days', { precision: 3, scale: 0 }).default('0'),

    // Administrative metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id')
        .notNull()
        .references(() => users.id),
    updatedById: uuid('updated_by_id')
        .notNull()
        .references(() => users.id),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id)
});

export const serviceListingPlanRelations = relations(serviceListingPlans, ({ one, many }) => ({
    // Service listings using this plan
    serviceListings: many(serviceListings, {
        relationName: 'service_listing_plan_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [serviceListingPlans.createdById],
        references: [users.id],
        relationName: 'service_listing_plan_created_by'
    }),
    updatedBy: one(users, {
        fields: [serviceListingPlans.updatedById],
        references: [users.id],
        relationName: 'service_listing_plan_updated_by'
    }),
    deletedBy: one(users, {
        fields: [serviceListingPlans.deletedById],
        references: [users.id],
        relationName: 'service_listing_plan_deleted_by'
    })
}));

export type ServiceListingPlan = typeof serviceListingPlans.$inferSelect;
export type NewServiceListingPlan = typeof serviceListingPlans.$inferInsert;
