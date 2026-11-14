/**
 * Staff read of the listing AI chat conversations (HOS-2075).
 *
 * Read-only. The staff sees the conversation (turns in order) but NEVER who
 * wrote it: no `userId`, name or email. Every `.strict()` so a column added to a
 * query cannot reach the response unnoticed. Text is redacted at read time
 * (`scrubPii`); storage stays verbatim.
 *
 * @module schemas/ai/ai-conversations-admin
 */

import { z } from 'zod';
import { AiChatEntityTypeSchema } from './ai-chat.schema.js';
import { AiChatDateSchema } from './ai-listing-questions.schema.js';

/**
 * Query of `GET /api/v1/admin/ai/conversations`. Pagination (`page`, `pageSize`)
 * is added by the admin list route, not declared here.
 */
export const AiConversationsAdminQuerySchema = z.object({
    /** Narrow to one vertical. */
    entityType: AiChatEntityTypeSchema.optional(),
    /** Narrow to one listing. A non-UUID is a 400, never a database round-trip. */
    entityId: z.string().uuid().optional(),
    /** First day to include (UTC, `YYYY-MM-DD`). */
    from: AiChatDateSchema.optional(),
    /** Last day to include, inclusive (UTC, `YYYY-MM-DD`). */
    to: AiChatDateSchema.optional()
});

/** TypeScript type for {@link AiConversationsAdminQuerySchema}. */
export type AiConversationsAdminQuery = z.infer<typeof AiConversationsAdminQuerySchema>;

/** One row of the staff conversation list. */
export const AiConversationListItemSchema = z
    .object({
        /** Conversation id (staff only; never exposed to owners). */
        id: z.string().uuid(),
        entityType: AiChatEntityTypeSchema,
        entityId: z.string().uuid(),
        /** When the conversation started (ISO 8601). */
        startedAt: z.string(),
        /** Last activity (ISO 8601). */
        lastMessageAt: z.string(),
        /** Number of turns (user plus assistant). */
        messageCount: z.number().int().nonnegative(),
        /** First user question, redacted and truncated. */
        firstQuestion: z.string()
    })
    .strict();

/** TypeScript type for {@link AiConversationListItemSchema}. */
export type AiConversationListItem = z.infer<typeof AiConversationListItemSchema>;

/** One turn of a conversation. */
export const AiConversationTurnSchema = z
    .object({
        id: z.string().uuid(),
        role: z.enum(['user', 'assistant']),
        /** Redacted text. */
        content: z.string(),
        createdAt: z.string()
    })
    .strict();

/** TypeScript type for {@link AiConversationTurnSchema}. */
export type AiConversationTurn = z.infer<typeof AiConversationTurnSchema>;

/** Response of `GET /api/v1/admin/ai/conversations/:id`. */
export const AiConversationDetailSchema = z
    .object({
        id: z.string().uuid(),
        entityType: AiChatEntityTypeSchema,
        entityId: z.string().uuid(),
        startedAt: z.string(),
        /** Turns in chronological order. */
        turns: z.array(AiConversationTurnSchema)
    })
    .strict();

/** TypeScript type for {@link AiConversationDetailSchema}. */
export type AiConversationDetail = z.infer<typeof AiConversationDetailSchema>;
