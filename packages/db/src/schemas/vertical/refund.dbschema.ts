import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { manualPayments } from './manual-payment.dbschema.ts';
import { payments } from './payment.dbschema.ts';
import { quotedList } from './quoted-list.ts';

export const REFUND_STATUSES = ['REQUESTED', 'CONFIRMED', 'EXECUTED', 'FAILED'] as const;
export const REFUND_EXECUTION_CHANNELS = ['PROVIDER', 'EXTERNAL'] as const;
/** Where a refund that happened outside our flow was settled (RF4, HOS-1540). */
export const REFUND_EXTERNAL_CHANNELS = ['BANK_TRANSFER', 'PROVIDER_PANEL'] as const;

/** Refund request and settlement record (B5.md, AC:B5:32). */
export const refunds = pgTable(
    'refund',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** pago automático */
        paymentId: uuid('payment_id').references(() => payments.id),
        /** pago manual */
        manualPaymentId: uuid('manual_payment_id').references(() => manualPayments.id),
        /** monto */
        amount: integer('amount').notNull(),
        /** motivo */
        reason: varchar('reason', { length: 64 }).notNull(),
        /** estado */
        status: varchar('status', { length: 16 }).notNull(),
        /** quién confirmó */
        confirmedBy: uuid('confirmed_by').references(() => users.id),
        /** canal de ejecución */
        executedVia: varchar('executed_via', { length: 16 }),
        /** quién asentó */
        settledBy: uuid('settled_by').references(() => users.id),
        /** por dónde se asentó una devolución por fuera (RF4) */
        externalChannel: varchar('external_channel', { length: 16 }),
        /** referencia externa */
        externalRef: text('external_ref'),
        /** versión optimista */
        version: integer('version').notNull().default(1),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        onePayment: check(
            'ck_refund_one_payment',
            sql`(${t.paymentId} IS NOT NULL) <> (${t.manualPaymentId} IS NOT NULL)`
        ),
        amountPositive: check('ck_refund_amount_positive', sql`${t.amount} > 0`),
        status: check('ck_refund_status', sql`${t.status} IN (${quotedList(REFUND_STATUSES)})`),
        executionChannel: check(
            'ck_refund_execution_channel',
            sql`${t.executedVia} IS NULL OR ${t.executedVia} IN (${quotedList(REFUND_EXECUTION_CHANNELS)})`
        ),
        executionPair: check(
            'ck_refund_execution_pair',
            sql`(${t.status} = 'EXECUTED') = (${t.executedVia} IS NOT NULL)`
        ),
        settledByExecution: check(
            'ck_refund_settled_by_execution',
            sql`${t.settledBy} IS NULL OR ${t.status} = 'EXECUTED'`
        ),
        version: check('ck_refund_version', sql`${t.version} >= 1`),
        externalChannel: check(
            'ck_refund_external_channel',
            sql`${t.externalChannel} IS NULL OR (${t.executedVia} IS NOT DISTINCT FROM 'EXTERNAL' AND ${t.externalChannel} IN (${quotedList(REFUND_EXTERNAL_CHANNELS)}))`
        ),
        providerPanelReference: uniqueIndex('uq_refund_provider_panel_reference')
            .on(t.externalRef)
            .where(sql`${t.externalChannel} = 'PROVIDER_PANEL'`)
    })
);

/** Insert shape for a refund. */
export type InsertRefund = typeof refunds.$inferInsert;
/** Select shape for a refund. */
export type SelectRefund = typeof refunds.$inferSelect;
