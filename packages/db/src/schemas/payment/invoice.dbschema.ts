import type { AdminInfoType } from '@repo/schemas';
import { InvoiceStatusEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema.js';
import { InvoiceStatusPgEnum } from '../enums.dbschema.js';
import { users } from '../user/user.dbschema.js';

export const invoices = pgTable('invoices', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Client relationship (required)
    clientId: uuid('client_id')
        .references(() => clients.id, { onDelete: 'restrict' })
        .notNull(),

    // Invoice identification
    invoiceNumber: text('invoice_number').notNull().unique(),

    // Status
    status: InvoiceStatusPgEnum('status').notNull().default(InvoiceStatusEnum.OPEN),

    // Amount and currency fields (aligned with Zod schema)
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().$type<number>(),
    taxes: numeric('taxes', { precision: 10, scale: 2 }).notNull().default('0.00').$type<number>(),
    total: numeric('total', { precision: 10, scale: 2 }).notNull().$type<number>(),

    // Currency
    currency: text('currency').notNull().default('USD'),

    // Invoice dates (aligned with Zod schema)
    issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    // Optional text fields (aligned with Zod schema)
    description: text('description'),
    paymentTerms: text('payment_terms'),
    notes: text('notes'),

    // Invoice metadata
    metadata: jsonb('metadata'),

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

export const invoiceRelations = relations(invoices, ({ one }) => ({
    // Client relationship
    client: one(clients, {
        fields: [invoices.clientId],
        references: [clients.id]
    }),

    // User relationships for audit
    createdBy: one(users, {
        fields: [invoices.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [invoices.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [invoices.deletedById],
        references: [users.id]
    })

    // Related entities (Forward declarations to avoid circular imports)
    // invoiceLines: many(invoiceLines),
    // payments: many(payments),
    // creditNotes: many(creditNotes)
}));
