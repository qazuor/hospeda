import { sql } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';

/**
 * Notification log table.
 * Tracks the notifications the platform sends (email and other channels).
 *
 * This is the canonical Drizzle schema definition for the `notification_log`
 * table. It used to be called `billing_notification_log`; HOS-1419 gave it a
 * neutral name because it outlived the old billing system it was born in. The
 * former `customer_id` column (FK to `billing_customers`) was removed together
 * with that billing schema (HOS-1416).
 *
 * The `idempotencyKey` field is stored inside the JSONB `metadata` column as
 * `metadata->>'idempotencyKey'` for deduplication queries.
 */
export const notificationLog = pgTable(
    'notification_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        type: varchar('type', { length: 100 }).notNull(),
        channel: varchar('channel', { length: 50 }).notNull(),
        recipient: varchar('recipient', { length: 255 }).notNull(),
        subject: varchar('subject', { length: 500 }).notNull(),
        templateId: varchar('template_id', { length: 100 }),
        status: varchar('status', { length: 50 }).notNull().default('queued'),
        sentAt: timestamp('sent_at', { withTimezone: true }),
        errorMessage: text('error_message'),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        expiredAt: timestamp('expired_at', { withTimezone: true })
    },
    (table) => ({
        notificationLog_type_idx: index('notificationLog_type_idx').on(table.type),
        notificationLog_status_idx: index('notificationLog_status_idx').on(table.status),
        notificationLog_createdAt_idx: index('notificationLog_createdAt_idx').on(table.createdAt),
        notificationLog_status_created_idx: index('notificationLog_status_created_idx').on(
            table.status,
            table.createdAt
        ),
        notificationLog_expiredAt_idx: index('notificationLog_expiredAt_idx').on(table.expiredAt),
        /**
         * Partial UNIQUE functional index on `metadata->>'idempotencyKey'`.
         * Rows without an idempotency key are unconstrained; rows that carry
         * one cannot be delivered twice. Lived in `extras/004` while the table
         * was billing's; HOS-1419 moved it into the structural carril.
         */
        notificationLog_idempotencyKey_idx: uniqueIndex('idx_notification_log_idempotency_key')
            .on(sql`(${table.metadata}->>'idempotencyKey')`)
            .where(sql`${table.metadata}->>'idempotencyKey' IS NOT NULL`)
    })
);
