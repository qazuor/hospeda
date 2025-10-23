import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';
import { subscriptionItems } from './subscriptionItem.dbschema';

export const purchases = pgTable('purchases', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    pricingPlanId: uuid('pricing_plan_id')
        .notNull()
        .references(() => pricingPlans.id, { onDelete: 'restrict' }),

    // Purchase timestamp
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),

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

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
    // Parent relations
    client: one(clients, {
        fields: [purchases.clientId],
        references: [clients.id]
    }),
    pricingPlan: one(pricingPlans, {
        fields: [purchases.pricingPlanId],
        references: [pricingPlans.id]
    }),

    // Child relations
    subscriptionItems: many(subscriptionItems, {
        relationName: 'subscription_items_from_purchase'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [purchases.createdById],
        references: [users.id],
        relationName: 'purchase_created_by'
    }),
    updatedBy: one(users, {
        fields: [purchases.updatedById],
        references: [users.id],
        relationName: 'purchase_updated_by'
    }),
    deletedBy: one(users, {
        fields: [purchases.deletedById],
        references: [users.id],
        relationName: 'purchase_deleted_by'
    })
}));
