import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, date, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { ListingStatusPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';
import { benefitListingPlans } from './benefitListingPlan.dbschema';
import { benefitPartners } from './benefitPartner.dbschema';

/**
 * BENEFIT_LISTING Schema - Etapa 2.10: Grupo Listados de Beneficios
 * Individual benefit listings from partners using specific listing plans
 */
export const benefitListings = pgTable('benefit_listings', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Client relationship (who owns this listing)
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Partner relationship
    benefitPartnerId: uuid('benefit_partner_id')
        .notNull()
        .references(() => benefitPartners.id, { onDelete: 'cascade' }),

    // Listing plan relationship
    listingPlanId: uuid('listing_plan_id')
        .notNull()
        .references(() => benefitListingPlans.id, { onDelete: 'restrict' }),

    // Listing status
    status: ListingStatusPgEnum('status').notNull().default('ACTIVE'),

    // Benefit details
    title: text('title').notNull(),
    description: text('description').notNull(),
    benefitDetails: jsonb('benefit_details').$type<{
        discountPercent?: number;
        discountAmount?: number;
        freeItems?: string[];
        specialOffers?: string[];
        terms?: string[];
        validDays?: string[]; // e.g., ['monday', 'tuesday']
        validHours?: string; // e.g., '09:00-18:00'
    }>(),

    // Trial information
    isTrialPeriod: boolean('is_trial_period').notNull().default(false),
    trialStartDate: date('trial_start_date'),
    trialEndDate: date('trial_end_date'),

    // Listing dates
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),

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

export const benefitListingRelations = relations(benefitListings, ({ one }) => ({
    // Client relationship
    client: one(clients, {
        fields: [benefitListings.clientId],
        references: [clients.id],
        relationName: 'client_benefit_listings'
    }),

    // Partner relationship
    benefitPartner: one(benefitPartners, {
        fields: [benefitListings.benefitPartnerId],
        references: [benefitPartners.id],
        relationName: 'partner_benefit_listings'
    }),

    // Listing plan relationship
    listingPlan: one(benefitListingPlans, {
        fields: [benefitListings.listingPlanId],
        references: [benefitListingPlans.id],
        relationName: 'listing_plan_benefits'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [benefitListings.createdById],
        references: [users.id],
        relationName: 'benefit_listing_created_by'
    }),
    updatedBy: one(users, {
        fields: [benefitListings.updatedById],
        references: [users.id],
        relationName: 'benefit_listing_updated_by'
    }),
    deletedBy: one(users, {
        fields: [benefitListings.deletedById],
        references: [users.id],
        relationName: 'benefit_listing_deleted_by'
    })
}));

export type BenefitListing = typeof benefitListings.$inferSelect;
export type NewBenefitListing = typeof benefitListings.$inferInsert;
