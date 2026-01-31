import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Billing notification log table
 * Tracks all billing-related notifications sent to customers
 */
export const billingNotificationLog: ReturnType<typeof pgTable> = pgTable(
    'billing_notification_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id'),
        type: varchar('type', { length: 100 }).notNull(),
        channel: varchar('channel', { length: 50 }).notNull(),
        recipient: varchar('recipient', { length: 255 }).notNull(),
        subject: varchar('subject', { length: 500 }).notNull(),
        templateId: varchar('template_id', { length: 100 }),
        status: varchar('status', { length: 50 }).notNull().default('queued'),
        sentAt: timestamp('sent_at', { withTimezone: true }),
        errorMessage: text('error_message'),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        notificationLog_customerId_idx: index('notificationLog_customerId_idx').on(
            table.customerId
        ),
        notificationLog_type_idx: index('notificationLog_type_idx').on(table.type),
        notificationLog_status_idx: index('notificationLog_status_idx').on(table.status),
        notificationLog_createdAt_idx: index('notificationLog_createdAt_idx').on(table.createdAt),
        notificationLog_customer_type_idx: index('notificationLog_customer_type_idx').on(
            table.customerId,
            table.type
        )
    })
);
