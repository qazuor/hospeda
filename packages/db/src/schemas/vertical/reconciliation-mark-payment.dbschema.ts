import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { manualPayments } from './manual-payment.dbschema.ts';
import { payments } from './payment.dbschema.ts';
import { reconciliationMarks } from './reconciliation-mark.dbschema.ts';
import { refunds } from './refund.dbschema.ts';

/** Payment attached to a reconciliation mark (B5.md, AC:B5:32). */
export const reconciliationMarkPayments = pgTable(
    'reconciliation_mark_payment',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** marca */
        markId: uuid('mark_id').notNull(),
        /** pago automático */
        paymentId: uuid('payment_id'),
        /** pago manual */
        manualPaymentId: uuid('manual_payment_id'),
        /** cuándo se colgó */
        hungAt: timestamp('hung_at', { withTimezone: true }).notNull().defaultNow(),
        /** cuándo se resolvió */
        resolvedAt: timestamp('resolved_at', { withTimezone: true }),
        /** devolución que lo asienta */
        refundId: uuid('refund_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        onePayment: check(
            'ck_reconciliation_mark_payment_one_payment',
            sql`(${t.paymentId} IS NOT NULL) <> (${t.manualPaymentId} IS NOT NULL)`
        ),
        markFk: foreignKey({
            name: 'fk_reconciliation_mark_payment_mark',
            columns: [t.markId],
            foreignColumns: [reconciliationMarks.id]
        }),
        paymentFk: foreignKey({
            name: 'fk_reconciliation_mark_payment_payment',
            columns: [t.paymentId],
            foreignColumns: [payments.id]
        }),
        manualPaymentFk: foreignKey({
            name: 'fk_reconciliation_mark_payment_manual_payment',
            columns: [t.manualPaymentId],
            foreignColumns: [manualPayments.id]
        }),
        refundFk: foreignKey({
            name: 'fk_reconciliation_mark_payment_refund',
            columns: [t.refundId],
            foreignColumns: [refunds.id]
        }),
        paymentUnique: unique('uq_reconciliation_mark_payment_payment').on(t.markId, t.paymentId),
        manualPaymentUnique: unique('uq_reconciliation_mark_payment_manual_payment').on(
            t.markId,
            t.manualPaymentId
        )
    })
);

/** Insert shape for a reconciliation mark payment. */
export type InsertReconciliationMarkPayment = typeof reconciliationMarkPayments.$inferInsert;
/** Select shape for a reconciliation mark payment. */
export type SelectReconciliationMarkPayment = typeof reconciliationMarkPayments.$inferSelect;
