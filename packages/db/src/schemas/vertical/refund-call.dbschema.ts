import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { addonInstances } from './addon-product.dbschema.ts';
import { idempotencyKeys } from './idempotency-key.dbschema.ts';
import { refunds } from './refund.dbschema.ts';

/** A persisted provider refund call (B5.md, AC:B5:32; DECISIÓN 1). */
export const refundCalls = pgTable(
    'refund_call',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** devolución */
        refundId: uuid('refund_id')
            .notNull()
            .references(() => refunds.id),
        /** clave de idempotencia */
        idempotencyKey: varchar('idempotency_key', { length: 255 })
            .notNull()
            .references(() => idempotencyKeys.key),
        /** id de devolución del proveedor */
        providerRefundId: varchar('provider_refund_id', { length: 255 }),
        /** monto de esta llamada */
        amount: integer('amount').notNull(),
        /** instancia de addon / orden */
        addonInstanceId: uuid('addon_instance_id').references(() => addonInstances.id),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        amountPositive: check('ck_refund_call_amount_positive', sql`${t.amount} > 0`),
        idempotencyKeyUnique: unique('uq_refund_call_idempotency_key').on(t.idempotencyKey),
        providerRefundIdUnique: unique('uq_refund_call_provider_refund_id').on(t.providerRefundId),
        orderAwaitingId: uniqueIndex('uq_refund_call_order_awaiting_id')
            .on(t.addonInstanceId)
            .where(sql`${t.addonInstanceId} IS NOT NULL AND ${t.providerRefundId} IS NULL`)
    })
);

/** Insert shape for a refund call. */
export type InsertRefundCall = typeof refundCalls.$inferInsert;
/** Select shape for a refund call. */
export type SelectRefundCall = typeof refundCalls.$inferSelect;
