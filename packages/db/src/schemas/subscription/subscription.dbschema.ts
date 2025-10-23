import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema';
import { clients } from '../client/client.dbschema';
import { SubscriptionStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { subscriptionItems } from './subscriptionItem.dbschema';

export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    pricingPlanId: uuid('pricing_plan_id')
        .notNull()
        .references(() => pricingPlans.id, { onDelete: 'restrict' }),

    // Status using enum
    status: SubscriptionStatusPgEnum('status').notNull(),

    // Timestamps
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

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

export const subscriptionRelations = relations(subscriptions, ({ one, many }) => ({
    // Parent relations
    client: one(clients, {
        fields: [subscriptions.clientId],
        references: [clients.id]
    }),
    pricingPlan: one(pricingPlans, {
        fields: [subscriptions.pricingPlanId],
        references: [pricingPlans.id]
    }),

    // Child relations
    subscriptionItems: many(subscriptionItems, {
        relationName: 'subscription_items_from_subscription'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [subscriptions.createdById],
        references: [users.id],
        relationName: 'subscription_created_by'
    }),
    updatedBy: one(users, {
        fields: [subscriptions.updatedById],
        references: [users.id],
        relationName: 'subscription_updated_by'
    }),
    deletedBy: one(users, {
        fields: [subscriptions.deletedById],
        references: [users.id],
        relationName: 'subscription_deleted_by'
    })
}));
