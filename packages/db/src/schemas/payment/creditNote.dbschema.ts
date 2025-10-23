import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { decimal, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { invoices } from './invoice.dbschema';

export const creditNotes = pgTable('credit_notes', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Invoice relationship (required)
    invoiceId: uuid('invoice_id')
        .notNull()
        .references(() => invoices.id, { onDelete: 'cascade' }),

    // Credit note info
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    reason: text('reason'), // Reason for credit note
    issuedAt: timestamp('issued_at', { withTimezone: true }),

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

export const creditNoteRelations = relations(creditNotes, ({ one }) => ({
    // Invoice relationship
    invoice: one(invoices, {
        fields: [creditNotes.invoiceId],
        references: [invoices.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [creditNotes.createdById],
        references: [users.id],
        relationName: 'credit_note_created_by'
    }),
    updatedBy: one(users, {
        fields: [creditNotes.updatedById],
        references: [users.id],
        relationName: 'credit_note_updated_by'
    }),
    deletedBy: one(users, {
        fields: [creditNotes.deletedById],
        references: [users.id],
        relationName: 'credit_note_deleted_by'
    })
}));
