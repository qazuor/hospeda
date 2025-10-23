import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { AccessRightScopePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { clients } from './client.dbschema.ts';

export const clientAccessRights = pgTable('client_access_rights', {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
        .references(() => clients.id, { onDelete: 'cascade' })
        .notNull(),
    subscriptionItemId: uuid('subscription_item_id').notNull(), // Will be proper FK later when SUBSCRIPTION_ITEM table exists
    feature: text('feature').notNull(),
    scope: AccessRightScopePgEnum('scope').notNull(),

    // Polymorphic fields for scoped access (nullable for GLOBAL scope)
    scopeId: uuid('scope_id'),
    scopeType: text('scope_type'),

    // Validity period
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),

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

export const clientAccessRightRelations = relations(clientAccessRights, ({ one }) => ({
    // Client relation
    client: one(clients, {
        fields: [clientAccessRights.clientId],
        references: [clients.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [clientAccessRights.createdById],
        references: [users.id],
        relationName: 'client_access_right_created_by'
    }),

    updatedBy: one(users, {
        fields: [clientAccessRights.updatedById],
        references: [users.id],
        relationName: 'client_access_right_updated_by'
    }),

    deletedBy: one(users, {
        fields: [clientAccessRights.deletedById],
        references: [users.id],
        relationName: 'client_access_right_deleted_by'
    })
}));
