import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { decimal, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PaymentProviderPgEnum, PaymentStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { invoices } from './invoice.dbschema';
import { refunds } from './refund.dbschema';

export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Invoice relationship (required)
    invoiceId: uuid('invoice_id')
        .notNull()
        .references(() => invoices.id, { onDelete: 'cascade' }),

    // Payment amount information
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),

    // Payment provider info
    provider: PaymentProviderPgEnum('provider').notNull(),
    status: PaymentStatusPgEnum('status').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    providerPaymentId: text('provider_payment_id'), // ID from payment provider

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

export const paymentRelations = relations(payments, ({ one, many }) => ({
    // Invoice relationship
    invoice: one(invoices, {
        fields: [payments.invoiceId],
        references: [invoices.id]
    }),

    // Child relations
    refunds: many(refunds, {
        relationName: 'refunds_from_payment'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [payments.createdById],
        references: [users.id],
        relationName: 'payment_created_by'
    }),
    updatedBy: one(users, {
        fields: [payments.updatedById],
        references: [users.id],
        relationName: 'payment_updated_by'
    }),
    deletedBy: one(users, {
        fields: [payments.deletedById],
        references: [users.id],
        relationName: 'payment_deleted_by'
    })
}));
