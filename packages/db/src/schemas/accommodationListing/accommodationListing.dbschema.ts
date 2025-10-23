import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema';
import { clients } from '../client/client.dbschema';
import { ListingStatusPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';
import { accommodationListingPlans } from './accommodationListingPlan.dbschema';

/**
 * ACCOMMODATION_LISTING Schema - Etapa 2.9: Grupo Listados de Alojamientos
 * Active listings of accommodations by clients using specific plans
 */
export const accommodationListings = pgTable('accommodation_listings', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Relationships
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),
    listingPlanId: uuid('listing_plan_id')
        .notNull()
        .references(() => accommodationListingPlans.id, { onDelete: 'restrict' }),

    // Listing details
    title: text('title').notNull(),
    description: text('description'),

    // Status and lifecycle
    status: ListingStatusPgEnum('status').notNull().default('TRIAL'), // ACTIVE, PAUSED, ARCHIVED, TRIAL

    // Trial system integration
    isTrialActive: boolean('is_trial_active').notNull().default(false),
    trialStartsAt: timestamp('trial_starts_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

    // Listing period
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    // Custom listing configuration (overrides plan defaults)
    customConfig: jsonb('custom_config').$type<{
        priorityLevel?: number;
        featuredUntil?: string; // ISO date
        customPricing?: {
            pricePerNight?: number;
            currency?: string;
            discounts?: Array<{
                type: 'percentage' | 'fixed';
                value: number;
                validFrom?: string;
                validTo?: string;
            }>;
        };
        visibility?: {
            hideFromSearch?: boolean;
            limitToRegions?: string[];
            limitToSeasons?: string[];
        };
        analytics?: {
            trackViews?: boolean;
            trackBookings?: boolean;
            reportingLevel?: 'basic' | 'detailed';
        };
    }>(),

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

export const accommodationListingRelations = relations(accommodationListings, ({ one }) => ({
    // Client relationship
    client: one(clients, {
        fields: [accommodationListings.clientId],
        references: [clients.id],
        relationName: 'client_accommodation_listings'
    }),

    // Accommodation relationship
    accommodation: one(accommodations, {
        fields: [accommodationListings.accommodationId],
        references: [accommodations.id],
        relationName: 'accommodation_listings'
    }),

    // Listing plan relationship
    listingPlan: one(accommodationListingPlans, {
        fields: [accommodationListings.listingPlanId],
        references: [accommodationListingPlans.id],
        relationName: 'plan_accommodation_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [accommodationListings.createdById],
        references: [users.id],
        relationName: 'accommodation_listing_created_by'
    }),
    updatedBy: one(users, {
        fields: [accommodationListings.updatedById],
        references: [users.id],
        relationName: 'accommodation_listing_updated_by'
    }),
    deletedBy: one(users, {
        fields: [accommodationListings.deletedById],
        references: [users.id],
        relationName: 'accommodation_listing_deleted_by'
    })
}));

export type AccommodationListing = typeof accommodationListings.$inferSelect;
export type NewAccommodationListing = typeof accommodationListings.$inferInsert;
