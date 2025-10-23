import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { payments } from './payment.dbschema';

export const refunds = pgTable('refunds', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    paymentId: uuid('payment_id')
        .notNull()
        .references(() => payments.id, { onDelete: 'cascade' }),

    // Refund info
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(), // Amount in minor currency units (cents)
    reason: text('reason'), // Reason for refund
    refundedAt: timestamp('refunded_at', { withTimezone: true }),

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

export const refundRelations = relations(refunds, ({ one }) => ({
    // Parent relations
    payment: one(payments, {
        fields: [refunds.paymentId],
        references: [payments.id],
        relationName: 'refunds_from_payment'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [refunds.createdById],
        references: [users.id],
        relationName: 'refund_created_by'
    }),
    updatedBy: one(users, {
        fields: [refunds.updatedById],
        references: [users.id],
        relationName: 'refund_updated_by'
    }),
    deletedBy: one(users, {
        fields: [refunds.deletedById],
        references: [users.id],
        relationName: 'refund_deleted_by'
    })
}));
