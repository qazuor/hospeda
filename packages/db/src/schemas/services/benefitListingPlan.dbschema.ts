import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { benefitListings } from './benefitListing.dbschema';

/**
 * BENEFIT_LISTING_PLAN Schema - Etapa 2.10: Grupo Listados de Beneficios
 * Plans that define the limits and features for benefit listings
 */
export const benefitListingPlans = pgTable('benefit_listing_plans', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Plan information
    name: text('name').notNull(),
    description: text('description'),

    // Plan limits and features (JSONB for flexibility)
    limits: jsonb('limits').$type<{
        maxListings?: number;
        maxBenefitsPerListing?: number;
        allowCustomBranding?: boolean;
        allowAnalytics?: boolean;
        allowPromotions?: boolean;
        allowTrialPeriods?: boolean;
        maxTrialDays?: number;
        features?: string[];
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

export const benefitListingPlanRelations = relations(benefitListingPlans, ({ one, many }) => ({
    // Benefit listings using this plan
    benefitListings: many(benefitListings, {
        relationName: 'listing_plan_benefits'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [benefitListingPlans.createdById],
        references: [users.id],
        relationName: 'benefit_listing_plan_created_by'
    }),
    updatedBy: one(users, {
        fields: [benefitListingPlans.updatedById],
        references: [users.id],
        relationName: 'benefit_listing_plan_updated_by'
    }),
    deletedBy: one(users, {
        fields: [benefitListingPlans.deletedById],
        references: [users.id],
        relationName: 'benefit_listing_plan_deleted_by'
    })
}));

export type BenefitListingPlan = typeof benefitListingPlans.$inferSelect;
export type NewBenefitListingPlan = typeof benefitListingPlans.$inferInsert;
