import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { accommodationListings } from './accommodationListing.dbschema';

/**
 * ACCOMMODATION_LISTING_PLAN Schema - Etapa 2.9: Grupo Listados de Alojamientos
 * Plans that define the limits and features for accommodation listings
 */
export const accommodationListingPlans = pgTable('accommodation_listing_plans', {
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
        maxFeaturedDays?: number;
        maxDescriptionLength?: number;
        allowPremiumFeatures?: boolean;
        allowAnalytics?: boolean;
        allowCustomPricing?: boolean;
        supportLevel?: 'basic' | 'standard' | 'premium';
        refreshInterval?: number; // days
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

export const accommodationListingPlanRelations = relations(
    accommodationListingPlans,
    ({ one, many }) => ({
        // Accommodation listings using this plan
        accommodationListings: many(accommodationListings, {
            relationName: 'plan_accommodation_listings'
        }),

        // Audit relations
        createdBy: one(users, {
            fields: [accommodationListingPlans.createdById],
            references: [users.id],
            relationName: 'accommodation_listing_plan_created_by'
        }),
        updatedBy: one(users, {
            fields: [accommodationListingPlans.updatedById],
            references: [users.id],
            relationName: 'accommodation_listing_plan_updated_by'
        }),
        deletedBy: one(users, {
            fields: [accommodationListingPlans.deletedById],
            references: [users.id],
            relationName: 'accommodation_listing_plan_deleted_by'
        })
    })
);

export type AccommodationListingPlan = typeof accommodationListingPlans.$inferSelect;
export type NewAccommodationListingPlan = typeof accommodationListingPlans.$inferInsert;
