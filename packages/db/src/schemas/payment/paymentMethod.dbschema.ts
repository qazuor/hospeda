import type { AdminInfoType } from '@repo/schemas';
import type { PaymentMethodEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { PaymentMethodPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema';

export const paymentMethods = pgTable('payment_methods', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Payment method type
    type: PaymentMethodPgEnum('type').notNull().$type<PaymentMethodEnum>(),

    // Display information
    displayName: varchar('display_name', { length: 100 }).notNull(),

    // Status flags
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    // Credit Card specific fields (optional)
    cardLast4: varchar('card_last_4', { length: 4 }),
    cardBrand: varchar('card_brand', { length: 20 }),
    cardExpiryMonth: integer('card_expiry_month'),
    cardExpiryYear: integer('card_expiry_year'),

    // Bank Account specific fields (optional)
    bankName: varchar('bank_name', { length: 100 }),
    accountLast4: varchar('account_last_4', { length: 4 }),
    accountType: varchar('account_type', { length: 20 }).$type<'CHECKING' | 'SAVINGS'>(), // 'CHECKING' or 'SAVINGS'

    // Provider integration fields
    providerPaymentMethodId: varchar('provider_payment_method_id', { length: 100 }),
    providerCustomerId: varchar('provider_customer_id', { length: 100 }),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

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
