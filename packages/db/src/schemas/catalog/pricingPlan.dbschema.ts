import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { BillingIntervalPgEnum, BillingSchemePgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema.js';
import { pricingTiers } from './pricingTier.dbschema.js';
import { products } from './product.dbschema.js';

export const pricingPlans = pgTable('pricing_plans', {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
        .references(() => products.id, { onDelete: 'cascade' })
        .notNull(),
    billingScheme: BillingSchemePgEnum('billing_scheme').notNull(),
    interval: BillingIntervalPgEnum('interval'), // Only required if billingScheme is RECURRING
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),

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

export const pricingPlanRelations = relations(pricingPlans, ({ one, many }) => ({
    // Product relation
    product: one(products, {
        fields: [pricingPlans.productId],
        references: [products.id]
    }),

    // Pricing tiers relation
    pricingTiers: many(pricingTiers),

    // Audit relations
    createdBy: one(users, {
        fields: [pricingPlans.createdById],
        references: [users.id],
        relationName: 'pricing_plan_created_by'
    }),

    updatedBy: one(users, {
        fields: [pricingPlans.updatedById],
        references: [users.id],
        relationName: 'pricing_plan_updated_by'
    }),

    deletedBy: one(users, {
        fields: [pricingPlans.deletedById],
        references: [users.id],
        relationName: 'pricing_plan_deleted_by'
    })

    // TODO [69b6291a-203f-43bd-bb69-dc37828e70a9]: Add benefitListings relation when services schema is implemented
    // benefitListings: many(benefitListings, {
    //     relationName: 'listing_plan_benefits'
    // })
}));
