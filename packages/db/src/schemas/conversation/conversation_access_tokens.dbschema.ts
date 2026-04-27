import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { conversations } from './conversations.dbschema.ts';

/**
 * Conversation access tokens table.
 *
 * Stores short-lived (30-day) access tokens that allow anonymous guests to view
 * and reply to their conversation thread without a platform account.
 *
 * Security notes:
 * - The raw token is never persisted. Only its SHA-256 hex hash (`token_hash`)
 *   is stored, preventing token recovery from a DB read.
 * - `token_hash` is varchar(64) matching the hex output of SHA-256 (32 bytes →
 *   64 hex characters).
 * - Tokens are revoked by setting `revoked_at`; the cron expiry job relies on
 *   `expires_at` for passive cleanup.
 *
 * Reminder flags (`day15_reminder_sent_at`, `day25_reminder_sent_at`) prevent
 * the reminder cron job from sending duplicate emails at days 15 and 25.
 *
 * The `updated_at` column is intentionally absent: this table is append-only
 * (insert + nullable-column updates). The set_updated_at trigger is therefore
 * not applied here.
 */
export const conversationAccessTokens = pgTable(
    'conversation_access_tokens',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → conversations.id. ON DELETE CASCADE: tokens are removed with the conversation. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => conversations.id, { onDelete: 'cascade' }),

        /**
         * SHA-256 hex hash of the raw access token.
         * varchar(64): exactly 64 hex characters for a SHA-256 digest.
         * Unique constraint ensures O(1) lookup and prevents hash collisions from
         * granting access to more than one conversation.
         */
        tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),

        /** When the token expires (created_at + 30 days). Tokens past this date are rejected. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

        /** Set on explicit revocation (admin action or conversation soft-delete cascade). NULL while active. */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),

        /**
         * Set when the day-15 reminder email is dispatched.
         * NULL means the reminder has not yet been sent. The cron job filters
         * tokens where this IS NULL and created_at is ~15 days ago.
         */
        day15ReminderSentAt: timestamp('day15_reminder_sent_at', { withTimezone: true }),

        /**
         * Set when the day-25 reminder email is dispatched.
         * NULL means the reminder has not yet been sent. The cron job filters
         * tokens where this IS NULL and created_at is ~25 days ago.
         */
        day25ReminderSentAt: timestamp('day25_reminder_sent_at', { withTimezone: true }),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /**
         * Primary lookup path: validate a guest access token by its hash.
         * The UNIQUE constraint on `token_hash` already creates a btree index;
         * this explicit index entry is provided for clarity and to match the
         * spec naming convention.
         */
        conversation_access_tokens_tokenHash_unique: index(
            'conversation_access_tokens_tokenHash_unique'
        ).on(table.tokenHash),

        /** Revocation query: find all active tokens for a given conversation. */
        conversation_access_tokens_conversationId_idx: index(
            'conversation_access_tokens_conversationId_idx'
        ).on(table.conversationId),

        /** Token expiry cron: find tokens nearing or past their expiry date. */
        conversation_access_tokens_expiresAt_idx: index(
            'conversation_access_tokens_expiresAt_idx'
        ).on(table.expiresAt)
    })
);

/**
 * Drizzle relations for the `conversation_access_tokens` table.
 */
export const accessTokensRelations = relations(conversationAccessTokens, ({ one }) => ({
    conversation: one(conversations, {
        fields: [conversationAccessTokens.conversationId],
        references: [conversations.id]
    })
}));

/** Type inference helpers. */
export type InsertConversationAccessToken = typeof conversationAccessTokens.$inferInsert;
export type SelectConversationAccessToken = typeof conversationAccessTokens.$inferSelect;
