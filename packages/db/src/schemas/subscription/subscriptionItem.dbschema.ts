import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    SubscriptionItemEntityTypePgEnum,
    SubscriptionItemSourceTypePgEnum
} from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { purchases } from './purchase.dbschema';
import { subscriptions } from './subscription.dbschema';

export const subscriptionItems = pgTable('subscription_items', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Polymorphic source system (subscription or purchase)
    sourceId: uuid('source_id').notNull(),
    sourceType: SubscriptionItemSourceTypePgEnum('source_type').notNull(),

    // Polymorphic entity system (what is being provided)
    linkedEntityId: uuid('linked_entity_id').notNull(),
    entityType: SubscriptionItemEntityTypePgEnum('entity_type').notNull(),

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

export const subscriptionItemRelations = relations(subscriptionItems, ({ one }) => ({
    // Polymorphic source relations (conditional based on sourceType)
    subscription: one(subscriptions, {
        fields: [subscriptionItems.sourceId],
        references: [subscriptions.id],
        relationName: 'subscription_items_from_subscription'
    }),
    purchase: one(purchases, {
        fields: [subscriptionItems.sourceId],
        references: [purchases.id],
        relationName: 'subscription_items_from_purchase'
    }),

    // Note: linkedEntity relations would be added as the target entities are implemented
    // For now, we just track the linkedEntityId and entityType

    // Audit relations
    createdBy: one(users, {
        fields: [subscriptionItems.createdById],
        references: [users.id],
        relationName: 'subscription_item_created_by'
    }),
    updatedBy: one(users, {
        fields: [subscriptionItems.updatedById],
        references: [users.id],
        relationName: 'subscription_item_updated_by'
    }),
    deletedBy: one(users, {
        fields: [subscriptionItems.deletedById],
        references: [users.id],
        relationName: 'subscription_item_deleted_by'
    })
}));
