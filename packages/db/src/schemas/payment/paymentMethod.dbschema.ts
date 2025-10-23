import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { PaymentProviderPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';

export const paymentMethods = pgTable('payment_methods', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Payment provider info
    provider: PaymentProviderPgEnum('provider').notNull(),
    token: text('token').notNull(), // Provider token/ID
    brand: text('brand'), // Card brand (Visa, MasterCard, etc.)
    last4: text('last4'), // Last 4 digits
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    defaultMethod: boolean('default_method').default(false).notNull(),

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

export const paymentMethodRelations = relations(paymentMethods, ({ one }) => ({
    // Parent relations
    client: one(clients, {
        fields: [paymentMethods.clientId],
        references: [clients.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [paymentMethods.createdById],
        references: [users.id],
        relationName: 'payment_method_created_by'
    }),
    updatedBy: one(users, {
        fields: [paymentMethods.updatedById],
        references: [users.id],
        relationName: 'payment_method_updated_by'
    }),
    deletedBy: one(users, {
        fields: [paymentMethods.deletedById],
        references: [users.id],
        relationName: 'payment_method_deleted_by'
    })
}));
