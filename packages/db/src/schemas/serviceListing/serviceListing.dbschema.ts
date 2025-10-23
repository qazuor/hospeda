import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';
import { serviceListingPlans } from './serviceListingPlan.dbschema';
import { touristServices } from './touristService.dbschema';

/**
 * SERVICE_LISTING Schema - Etapa 2.11: Grupo Listados de Servicios
 * Individual service listings created by clients for their tourist services
 */
export const serviceListings = pgTable('service_listings', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Foreign keys
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id),
    touristServiceId: uuid('tourist_service_id')
        .notNull()
        .references(() => touristServices.id),
    listingPlanId: uuid('listing_plan_id')
        .notNull()
        .references(() => serviceListingPlans.id),

    // Listing details
    title: text('title').notNull(),
    description: text('description'),

    // Pricing and booking
    basePrice: numeric('base_price', { precision: 10, scale: 2 }),

    // Listing configuration (JSONB for flexibility)
    listingDetails: jsonb('listing_details').$type<{
        // Availability
        availabilityType?: 'scheduled' | 'on-demand' | 'seasonal';
        scheduleDetails?: {
            daysOfWeek?: number[]; // 0-6 (Sun-Sat)
            timeSlots?: string[]; // "09:00", "14:00", etc.
            seasonalPeriods?: {
                startDate: string;
                endDate: string;
                available: boolean;
            }[];
        };

        // Booking settings
        bookingSettings?: {
            advanceBookingDays?: number;
            minGroupSize?: number;
            maxGroupSize?: number;
            instantBooking?: boolean;
            requiresApproval?: boolean;
            cancellationPolicy?: string;
            refundPolicy?: string;
        };

        // Media and content
        media?: {
            photos?: string[]; // URLs or paths
            videos?: string[]; // URLs or paths
            virtualTour?: string; // URL
        };

        // Multilingual content
        translations?: {
            [languageCode: string]: {
                title?: string;
                description?: string;
                highlights?: string[];
            };
        };

        // SEO and marketing
        seo?: {
            metaTitle?: string;
            metaDescription?: string;
            keywords?: string[];
            customUrl?: string;
        };

        // Additional features
        highlights?: string[];
        amenities?: string[];
        inclusions?: string[];
        exclusions?: string[];
        additionalInfo?: string;
        specialOffers?: {
            type: 'discount' | 'package' | 'early-bird';
            value: number;
            validFrom?: string;
            validUntil?: string;
            conditions?: string;
        }[];
    }>(),

    // Status and visibility
    status: text('status', {
        enum: ['draft', 'pending', 'active', 'paused', 'rejected', 'expired']
    })
        .notNull()
        .default('draft'),
    isActive: boolean('is_active').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),

    // Trial and subscription
    isTrialListing: boolean('is_trial_listing').notNull().default(false),
    trialStartDate: timestamp('trial_start_date', { withTimezone: true }),
    trialEndDate: timestamp('trial_end_date', { withTimezone: true }),

    // Publishing and expiry
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

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

export const serviceListingRelations = relations(serviceListings, ({ one }) => ({
    // Main relations
    client: one(clients, {
        fields: [serviceListings.clientId],
        references: [clients.id],
        relationName: 'client_service_listings'
    }),
    touristService: one(touristServices, {
        fields: [serviceListings.touristServiceId],
        references: [touristServices.id],
        relationName: 'tourist_service_listings'
    }),
    listingPlan: one(serviceListingPlans, {
        fields: [serviceListings.listingPlanId],
        references: [serviceListingPlans.id],
        relationName: 'service_listing_plan_listings'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [serviceListings.createdById],
        references: [users.id],
        relationName: 'service_listing_created_by'
    }),
    updatedBy: one(users, {
        fields: [serviceListings.updatedById],
        references: [users.id],
        relationName: 'service_listing_updated_by'
    }),
    deletedBy: one(users, {
        fields: [serviceListings.deletedById],
        references: [users.id],
        relationName: 'service_listing_deleted_by'
    })
}));

export type ServiceListing = typeof serviceListings.$inferSelect;
export type NewServiceListing = typeof serviceListings.$inferInsert;
