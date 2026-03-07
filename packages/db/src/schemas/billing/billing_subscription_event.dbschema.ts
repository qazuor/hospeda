import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * Audit trail of subscription state transitions.
 * Records every status change with its source and context.
 */
export const billingSubscriptionEvents = pgTable(
    'billing_subscription_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        previousStatus: varchar('previous_status', { length: 50 }).notNull(),
        newStatus: varchar('new_status', { length: 50 }).notNull(),
        triggerSource: varchar('trigger_source', { length: 50 }).notNull(),
        providerEventId: varchar('provider_event_id', { length: 255 }),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        idx_subscription_events_subscription_id: index(
            'idx_subscription_events_subscription_id'
        ).on(table.subscriptionId),
        idx_subscription_events_created_at: index('idx_subscription_events_created_at').on(
            table.createdAt.desc()
        )
    })
);
