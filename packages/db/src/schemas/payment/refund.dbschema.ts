import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { RefundReasonPgEnum, RefundStatusPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';
import { payments } from './payment.dbschema';

export const refunds = pgTable('refunds', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    paymentId: uuid('payment_id')
        .notNull()
        .references(() => payments.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'restrict' }),

    // Refund info
    refundNumber: text('refund_number').notNull().unique(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().$type<number>(),
    currency: text('currency').notNull().default('USD'),
    reason: RefundReasonPgEnum('reason'),
    description: text('description'),
    status: RefundStatusPgEnum('status').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processedById: uuid('processed_by_id').references(() => users.id, { onDelete: 'set null' }),
    providerRefundId: text('provider_refund_id'),
    providerResponse: jsonb('provider_response'),
    failureReason: text('failure_reason'),
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
    client: one(clients, {
        fields: [refunds.clientId],
        references: [clients.id],
        relationName: 'refunds_from_client'
    }),

    // Audit relations
    processedBy: one(users, {
        fields: [refunds.processedById],
        references: [users.id],
        relationName: 'refund_processed_by'
    }),
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
