import { sql } from 'drizzle-orm';
import { check, integer, pgTable, smallint, timestamp } from 'drizzle-orm/pg-core';

/**
 * Single serialized receipt counter row (02 §2.3): incremented in the SAME
 * transaction that writes the receipt. A sequence leaves gaps on every rollback.
 */
export const receiptCounters = pgTable(
    'receipt_counter',
    {
        id: smallint('id').primaryKey(),
        lastNumber: integer('last_number').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        singleRow: check('ck_receipt_counter_single_row', sql`${t.id} = 1`),
        lastNumberPositive: check('ck_receipt_counter_last_number', sql`${t.lastNumber} >= 1`)
    })
);

export type InsertReceiptCounter = typeof receiptCounters.$inferInsert;
export type SelectReceiptCounter = typeof receiptCounters.$inferSelect;
