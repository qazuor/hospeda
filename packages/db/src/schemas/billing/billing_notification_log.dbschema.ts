import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Billing notification log table
 * Tracks all billing-related notifications sent to customers.
 *
 * This is the canonical Drizzle schema definition for the `billing_notification_log`
 * table. The QZPay billing package does NOT own this table — it is Hospeda-specific
 * and managed via Drizzle migrations in this package.
 *
 * The `idempotencyKey` field is stored inside the JSONB `metadata` column as
 * `metadata->>'idempotencyKey'` for deduplication queries in the addon-expiry cron job.
 *
 * The former `customer_id` column (FK to `billing_customers`) was removed together
 * with the legacy qzpay billing schema it referenced (HOS-1416).
 */
export const billingNotificationLog = pgTable(
    'billing_notification_log',
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
        notificationLog_expiredAt_idx: index('notificationLog_expiredAt_idx').on(table.expiredAt)
    })
);
