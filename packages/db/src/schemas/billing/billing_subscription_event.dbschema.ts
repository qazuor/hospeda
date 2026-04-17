import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingSubscriptions } from '../../billing/index.ts';

/**
 * Audit trail of subscription state transitions and operational events.
 * Records every status change (via previousStatus/newStatus) or non-transition
 * operational event (via eventType) with its source and context.
 *
 * State-transition rows: previousStatus + newStatus non-null, eventType null.
 * Operational-event rows: eventType non-null, previousStatus + newStatus may be null.
 */
export const billingSubscriptionEvents = pgTable(
    'billing_subscription_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        /**
         * Operational event type for non-transition events
         * (e.g. 'ADDON_RECALC_COMPLETED', 'ADDON_REVOCATIONS_PENDING').
         * Null for pure state-transition rows.
         */
        eventType: varchar('event_type', { length: 100 }),
        /**
         * Prior status before a state transition. Null for operational-event rows
         * that do not represent a status change.
         */
        previousStatus: varchar('previous_status', { length: 50 }),
        /**
         * Resulting status after a state transition. Null for operational-event rows
         * that do not represent a status change.
         */
        newStatus: varchar('new_status', { length: 50 }),
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
        ),
        idx_subscription_events_event_type: index('idx_subscription_events_event_type').on(
            table.eventType,
            table.subscriptionId,
            table.createdAt
        )
    })
);
