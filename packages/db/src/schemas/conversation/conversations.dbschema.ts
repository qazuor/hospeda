import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { ConversationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { conversationAccessTokens } from './conversation_access_tokens.dbschema.ts';
import { conversationNotificationSchedules } from './conversation_notification_schedules.dbschema.ts';
import { messages } from './messages.dbschema.ts';

/**
 * Conversations table.
 *
 * Represents a 1:1 messaging thread between a guest (anonymous or authenticated)
 * and the owner of a specific accommodation. A conversation is scoped to a single
 * accommodation and cannot be shared across multiple properties.
 *
 * Partial unique indexes (enforcing 1-conversation-per-identity rules) and the
 * anonymous-email linking index are defined in:
 *   packages/db/src/migrations/manual/0015_conversation_partial_indexes.sql
 *
 * The `updated_at` column is maintained automatically by the
 * `set_updated_at` trigger defined in:
 *   packages/db/src/migrations/manual/0005_set_updated_at_trigger.sql
 */
export const conversations = pgTable(
    'conversations',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → accommodations.id. ON DELETE RESTRICT: prevents accommodation hard-delete while conversations exist. */
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'restrict' }),

        /** FK → users.id. NULL for anonymous guests until registration linking. ON DELETE SET NULL. */
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

        /** Display name provided by anonymous guest at initiation. NULL for authenticated guests. */
        anonymousName: varchar('anonymous_name', { length: 255 }),

        /** Lowercase-normalised email provided by anonymous guest. NULL for authenticated guests. */
        anonymousEmail: varchar('anonymous_email', { length: 255 }),

        /** True after the anonymous guest clicks the verification link sent to their email. */
        anonymousEmailVerified: boolean('anonymous_email_verified').notNull().default(false),

        /** Optional phone number provided by anonymous guest at initiation. */
        anonymousPhone: varchar('anonymous_phone', { length: 50 }),

        /** Current lifecycle state of the conversation. */
        status: ConversationStatusPgEnum('status').notNull().default('PENDING_VERIFICATION'),

        /** Reason captured when owner blocks the conversation. NULL unless blocked. */
        blockReason: text('block_reason'),

        /** Locale at conversation creation — used to render email notification templates. */
        locale: varchar('locale', { length: 10 }).notNull().default('es'),

        /** True when the guest has archived the conversation from their inbox view. */
        archivedByGuest: boolean('archived_by_guest').notNull().default(false),

        /** True when the owner has archived the conversation from their inbox view. */
        archivedByOwner: boolean('archived_by_owner').notNull().default(false),

        /** Timestamp of the last read event for the guest side. Used for read receipts. */
        lastReadAtByGuest: timestamp('last_read_at_by_guest', { withTimezone: true }),

        /** Timestamp of the last read event for the owner side. Used for read receipts. */
        lastReadAtByOwner: timestamp('last_read_at_by_owner', { withTimezone: true }),

        // ---- Metrics columns (denormalised counters / first-event timestamps) ----

        /** Timestamp of the first message sent by the guest. Set once, never updated. */
        firstGuestMessageAt: timestamp('first_guest_message_at', { withTimezone: true }),

        /** Timestamp of the first reply sent by the owner. Set once, never updated. */
        firstOwnerReplyAt: timestamp('first_owner_reply_at', { withTimezone: true }),

        /** Timestamp of the most recent message on either side. Updated on every new message. */
        lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),

        /** Timestamp of the most recent guest message. */
        lastGuestMessageAt: timestamp('last_guest_message_at', { withTimezone: true }),

        /** Timestamp of the most recent owner message. */
        lastOwnerMessageAt: timestamp('last_owner_message_at', { withTimezone: true }),

        /** Timestamp when the conversation was closed (status → CLOSED). */
        closedAt: timestamp('closed_at', { withTimezone: true }),

        /** Timestamp when the conversation was blocked (status → BLOCKED). */
        blockedAt: timestamp('blocked_at', { withTimezone: true }),

        /** Running count of messages sent by the guest. Incremented on each guest message. */
        guestMessageCount: integer('guest_message_count').notNull().default(0),

        /** Running count of messages sent by the owner. Incremented on each owner message. */
        ownerMessageCount: integer('owner_message_count').notNull().default(0),

        // ---- Audit columns ----

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

        /** NULL for anonymous-initiated conversations (no user session at creation time). */
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        /** Soft delete — set by admin only. */
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Owner inbox query: list all conversations for a given accommodation. */
        conversations_accommodationId_idx: index('conversations_accommodationId_idx').on(
            table.accommodationId
        ),

        /**
         * Guest /mi-cuenta/messages list query.
         * Partial: only rows where user_id IS NOT NULL benefit from this index.
         * Note: the partial UNIQUE index for (user_id, accommodation_id) lives in
         * manual SQL (0015_conversation_partial_indexes.sql).
         */
        conversations_userId_idx: index('conversations_userId_idx').on(table.userId),

        /** Admin filtering by conversation status. */
        conversations_status_idx: index('conversations_status_idx').on(table.status),

        /**
         * Default sort: newest activity first.
         * DESC ordering expressed at query time; the index still benefits range scans.
         */
        conversations_lastActivityAt_idx: index('conversations_lastActivityAt_idx').on(
            table.lastActivityAt
        ),

        /**
         * user.create hook: link anonymous conversations to a newly registered user.
         * Partial uniqueness for (anonymous_email, accommodation_id) lives in
         * manual SQL (0015_conversation_partial_indexes.sql).
         */
        conversations_anonymousEmail_idx: index('conversations_anonymousEmail_idx').on(
            table.anonymousEmail
        )
    })
);

/**
 * Drizzle relations for the `conversations` table.
 */
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    accommodation: one(accommodations, {
        fields: [conversations.accommodationId],
        references: [accommodations.id]
    }),
    user: one(users, {
        fields: [conversations.userId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [conversations.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [conversations.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [conversations.deletedById],
        references: [users.id]
    }),
    messages: many(messages),
    accessTokens: many(conversationAccessTokens),
    notificationSchedules: many(conversationNotificationSchedules)
}));

/** Type inference helpers. */
export type InsertConversation = typeof conversations.$inferInsert;
export type SelectConversation = typeof conversations.$inferSelect;
