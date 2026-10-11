import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { manualPayments } from './manual-payment.dbschema.ts';
import { payments } from './payment.dbschema.ts';

/** Non-fiscal receipt for exactly one payment (B5.md, AC:B5:32). */
export const receipts = pgTable(
    'receipt',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** pago automático */
        paymentId: uuid('payment_id').references(() => payments.id),
        /** pago manual */
        manualPaymentId: uuid('manual_payment_id').references(() => manualPayments.id),
        /** número correlativo */
        receiptNumber: integer('receipt_number').notNull(),
        /** referencia del PDF */
        pdfRef: text('pdf_ref'),
        /** nombre del pagador */
        payerName: varchar('payer_name', { length: 255 }),
        /** correo del pagador */
        payerEmail: varchar('payer_email', { length: 255 }),
        /** cuándo se emitió */
        issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        onePayment: check(
            'ck_receipt_one_payment',
            sql`(${t.paymentId} IS NOT NULL) <> (${t.manualPaymentId} IS NOT NULL)`
        ),
        payerPair: check(
            'ck_receipt_payer_pair',
            sql`(${t.payerName} IS NULL) = (${t.payerEmail} IS NULL)`
        ),
        receiptNumberUnique: unique('uq_receipt_receipt_number').on(t.receiptNumber)
    })
);

/** Insert shape for a receipt. */
export type InsertReceipt = typeof receipts.$inferInsert;
/** Select shape for a receipt. */
export type SelectReceipt = typeof receipts.$inferSelect;
