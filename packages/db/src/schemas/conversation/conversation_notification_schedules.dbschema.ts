import { relations } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { NotificationRecipientSidePgEnum } from '../enums.dbschema.ts';
import { conversations } from './conversations.dbschema.ts';

/**
 * Conversation notification schedules table.
 *
 * Tracks pending email notifications for each active unread streak per
 * (conversation, recipient side) pair. At most one active (non-cancelled) row
 * exists per pair at any time — enforced by a partial unique index in:
 *   packages/db/src/migrations/manual/0015_conversation_partial_indexes.sql
 *
 * Lifecycle:
 * 1. Row is inserted (or updated) when a new unread message arrives.
 * 2. `pending_notification_at` is set to `now() + 30 minutes`.
 * 3. The cron job runs every 5 minutes, finds rows where
 *    `pending_notification_at <= now()` AND `cancelled_at IS NULL`.
 * 4. The cron dispatches the email and either:
 *    - Increments `streak_count` and sets a new `pending_notification_at` for
 *      the next streak window (if streak_count < 3), or
 *    - Cancels the schedule (streak_count == 3 — no more emails until new activity).
 * 5. When the recipient reads the conversation or replies, the pending schedule
 *    is cancelled by setting `cancelled_at = now()`.
 *
 * The `updated_at` column is maintained automatically by the
 * `set_updated_at` trigger (0005_set_updated_at_trigger.sql).
 */
export const conversationNotificationSchedules = pgTable(
    'conversation_notification_schedules',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → conversations.id. ON DELETE CASCADE: schedules are removed with the conversation. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => conversations.id, { onDelete: 'cascade' }),

        /** Which side (GUEST or OWNER) should receive the notification. */
        recipientSide: NotificationRecipientSidePgEnum('recipient_side').notNull(),

        /**
         * When the notification email should be dispatched.
         * The cron job queries `WHERE pending_notification_at <= now() AND cancelled_at IS NULL`.
         */
        pendingNotificationAt: timestamp('pending_notification_at', {
            withTimezone: true
        }).notNull(),

        /**
         * Number of notifications already sent in the current unread streak.
         * Starts at 1 for the first pending notification; capped at 3.
         * After 3, no further emails are sent until new activity resets the streak.
         */
        streakCount: integer('streak_count').notNull().default(1),

        /**
         * Timestamp of the first unread message in the current streak.
         * Used for analytics and to detect new-activity reset conditions.
         */
        streakStartedAt: timestamp('streak_started_at', { withTimezone: true }).notNull(),

        /**
         * Set when the schedule is cancelled (recipient reads, replies, or the
         * conversation is blocked/deleted). NULL while active.
         */
        cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /**
         * Primary cron query path: find all due, non-cancelled notification schedules.
         * Partial index (WHERE cancelled_at IS NULL) reduces the scan to only active rows.
         * The partial UNIQUE index enforcing one-active-schedule-per-(conversation, side)
         * is in manual SQL (0015_conversation_partial_indexes.sql) because Drizzle does not
         * support partial unique indexes natively.
         */
        conv_notif_schedules_pending_idx: index('conv_notif_schedules_pending_idx').on(
            table.pendingNotificationAt
        ),

        /** Lookup: find active schedule for a given conversation to cancel or update it. */
        conv_notif_schedules_conversationId_idx: index(
            'conv_notif_schedules_conversationId_idx'
        ).on(table.conversationId)
    })
);

/**
 * Drizzle relations for the `conversation_notification_schedules` table.
 */
export const notificationSchedulesRelations = relations(
    conversationNotificationSchedules,
    ({ one }) => ({
        conversation: one(conversations, {
            fields: [conversationNotificationSchedules.conversationId],
            references: [conversations.id]
        })
    })
);

/** Type inference helpers. */
export type InsertConversationNotificationSchedule =
    typeof conversationNotificationSchedules.$inferInsert;
export type SelectConversationNotificationSchedule =
    typeof conversationNotificationSchedules.$inferSelect;
