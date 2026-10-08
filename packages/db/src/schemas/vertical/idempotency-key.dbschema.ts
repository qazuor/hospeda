import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { quotedList } from './quoted-list.ts';

export const IDEMPOTENCY_OPERATIONS = [
    'PREAPPROVAL_CREATE',
    'ORDER_CREATE',
    'REFUND_CREATE'
] as const;

/**
 * Idempotency key created here for S1 and persisted before the provider call
 * (AC:B3:38; Coord-21). Its primary key is unique, its operation belongs to a
 * closed set, and result and completion time are both null or both present.
 * subjectId identifies the operation row without a polymorphic FK.
 */
export const idempotencyKeys = pgTable(
    'idempotency_key',
    {
        /** la clave */
        key: varchar('key', { length: 255 }).primaryKey(),
        /** a qué operación corresponde */
        operation: varchar('operation', { length: 32 }).notNull(),
        /** la fila de la operación */
        subjectId: uuid('subject_id').notNull(),
        /** su resultado */
        result: jsonb('result'),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        operationCheck: check(
            'ck_idempotency_key_operation',
            sql`${t.operation} IN (${quotedList(IDEMPOTENCY_OPERATIONS)})`
        ),
        completionCheck: check(
            'ck_idempotency_key_completion',
            sql`(${t.result} IS NULL) = (${t.completedAt} IS NULL)`
        )
    })
);

/** Insert shape for an idempotency key. */
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;
/** Select shape for an idempotency key. */
export type SelectIdempotencyKey = typeof idempotencyKeys.$inferSelect;
