import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { aiConversations } from './ai_conversations.dbschema.ts';

/**
 * AI conversation messages table (SPEC-173 T-007).
 *
 * Stores the individual messages within an AI conversation (see
 * `ai_conversations.dbschema.ts`). Each row is one turn in a multi-turn
 * exchange.
 *
 * **Content policy (§5.10):** the `content` column stores the verbatim
 * message text as sent/received. PII is NOT scrubbed here — content is
 * stored raw in our DB (only `ai_request_log` scrubs PII before storage,
 * as that data goes to external telemetry). Verbatim storage preserves
 * conversation continuity for the RAG context window.
 *
 * The `role` column uses a varchar (`system` | `user` | `assistant`) aligned
 * with the Vercel AI SDK / OpenAI conversation role convention.
 *
 * Decision (owner-approved 2026-06-04): varchar chosen for AI enums (consistent
 * with repo — pgEnum is reserved for TS enums in @repo/schemas; AI values are
 * z.enum). Migrating to pgEnum is a future option if these are ever promoted to
 * TS enums.
 */
export const aiMessages = pgTable(
    'ai_messages',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * FK → ai_conversations.id.
         * ON DELETE CASCADE: deleting a conversation hard-removes all its messages.
         */
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => aiConversations.id, { onDelete: 'cascade' }),

        /**
         * Message role in the conversation.
         * Values: `system` | `user` | `assistant`
         * Aligned with the Vercel AI SDK / OpenAI conversation role convention.
         */
        role: varchar('role', { length: 20 }).notNull(),

        /**
         * Verbatim message content (stored raw — NOT PII-scrubbed, §5.10).
         * For outbound (assistant) messages: the full generated text.
         * For inbound (user) messages: the raw user input.
         * For system messages: the resolved system prompt for this turn.
         */
        content: text('content').notNull(),

        /**
         * Token count for this message (nullable).
         * Populated from the provider's usage metadata when available.
         * May be null for user messages if token counting is not applied
         * to inputs (provider-dependent).
         */
        tokens: integer('tokens'),

        /**
         * Provider that generated this message (nullable).
         * Set for `assistant` role messages; null for `user` / `system`.
         * Values: `openai` | `anthropic` | `stub`
         */
        provider: varchar('provider', { length: 50 }),

        /**
         * Whether an assistant chat answer actually answered the question
         * (HOS-2101): `answered` | `unanswered`. Written asynchronously by the
         * chat-answer classifier after the turn is persisted. NULL means "not
         * classified" — the classifier has not run, failed, or the row is not an
         * assistant chat answer — and is never read as either verdict.
         */
        answerStatus: varchar('answer_status', { length: 20 }),

        /** Owner dismissal timestamp for user questions (HOS-2105). */
        ownerDismissedAt: timestamp('owner_dismissed_at', { withTimezone: true }),

        // ---- Timestamps ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

        // ---- Soft delete ----
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Primary read path: load all messages for a conversation in
         * chronological order (infinite scroll / context window assembly).
         */
        aiMessages_conversationId_created_idx: index('aiMessages_conversationId_created_idx').on(
            table.conversationId,
            table.createdAt
        ),

        /**
         * Role filter: useful for extracting only user or assistant turns
         * when assembling a trimmed context window.
         */
        aiMessages_conversationId_role_idx: index('aiMessages_conversationId_role_idx').on(
            table.conversationId,
            table.role
        ),

        /**
         * Weekly digest query (HOS-2101): unanswered answers inside a window.
         */
        aiMessages_answerStatus_created_idx: index('aiMessages_answerStatus_created_idx').on(
            table.answerStatus,
            table.createdAt
        )
    })
);

/** Drizzle relations for `ai_messages`. */
export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
    conversation: one(aiConversations, {
        fields: [aiMessages.conversationId],
        references: [aiConversations.id]
    }),
    deletedBy: one(users, {
        fields: [aiMessages.deletedById],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertAiMessage = typeof aiMessages.$inferInsert;
export type SelectAiMessage = typeof aiMessages.$inferSelect;
