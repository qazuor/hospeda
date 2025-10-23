import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { bigint, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { pricingPlans } from './pricingPlan.dbschema.ts';

export const pricingTiers = pgTable('pricing_tiers', {
    id: uuid('id').primaryKey().defaultRandom(),
    pricingPlanId: uuid('pricing_plan_id')
        .references(() => pricingPlans.id, { onDelete: 'cascade' })
        .notNull(),
    minQuantity: integer('min_quantity').notNull(),
    maxQuantity: integer('max_quantity'), // null for unlimited
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),

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

export const pricingTierRelations = relations(pricingTiers, ({ one }) => ({
    // Pricing plan relation
    pricingPlan: one(pricingPlans, {
        fields: [pricingTiers.pricingPlanId],
        references: [pricingPlans.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [pricingTiers.createdById],
        references: [users.id],
        relationName: 'pricing_tier_created_by'
    }),

    updatedBy: one(users, {
        fields: [pricingTiers.updatedById],
        references: [users.id],
        relationName: 'pricing_tier_updated_by'
    }),

    deletedBy: one(users, {
        fields: [pricingTiers.deletedById],
        references: [users.id],
        relationName: 'pricing_tier_deleted_by'
    })
}));
