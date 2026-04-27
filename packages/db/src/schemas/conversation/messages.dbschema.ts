import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { MessageSenderTypePgEnum, MessageStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { conversations } from './conversations.dbschema.ts';

/**
 * Messages table.
 *
 * Stores individual messages within a conversation thread. Each message is
 * authored by a guest (anonymous or authenticated), the accommodation owner,
 * or the platform itself (SYSTEM messages for state transitions).
 *
 * The `body` column is limited to 5 000 characters. Zod validation enforces this
 * at the service layer; the DB-level CHECK constraint is applied via:
 *   packages/db/src/migrations/manual/0016_messages_body_length_check.sql
 *
 * The `updated_at` column is maintained automatically by the
 * `set_updated_at` trigger (0005_set_updated_at_trigger.sql).
 */
export const messages = pgTable(
    'messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → conversations.id. ON DELETE CASCADE: messages are deleted with the conversation. */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => conversations.id, { onDelete: 'cascade' }),

        /** Identifies which party authored the message. */
        senderType: MessageSenderTypePgEnum('sender_type').notNull(),

        /**
         * FK → users.id. NULL for anonymous guest messages and SYSTEM messages.
         * ON DELETE SET NULL: preserves message history when a user account is removed.
         */
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

        /**
         * Message body text. Maximum 5 000 characters.
         * The DB CHECK constraint `messages_body_length` is not expressible via Drizzle
         * and is therefore applied via manual SQL migration 0016.
         */
        body: text('body').notNull(),

        /** Visibility status of the message. SYSTEM messages are auto-generated. */
        status: MessageStatusPgEnum('status').notNull().default('VISIBLE'),

        // ---- Audit columns ----

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

        /** Audit FK for who created this record (NULL for anonymous/system-generated). */
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        /** Soft delete — admin-only. Hard-deleting a conversation cascades to messages. */
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Primary read path: load all messages for a thread in chronological order.
         * Composite index on (conversation_id, created_at ASC) covers the cursor-based
         * pagination pattern used for infinite scroll (created_at < :cursor).
         */
        messages_conversationId_idx: index('messages_conversationId_idx').on(
            table.conversationId,
            table.createdAt
        ),

        /** Secondary read path: filter out SYSTEM messages for display-only queries. */
        messages_conversationId_status_idx: index('messages_conversationId_status_idx').on(
            table.conversationId,
            table.status
        )
    })
);

/**
 * Drizzle relations for the `messages` table.
 */
export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id]
    }),
    user: one(users, {
        fields: [messages.userId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [messages.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [messages.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [messages.deletedById],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
