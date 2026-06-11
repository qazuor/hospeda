/**
 * Persistence helper for the conversational-search route (SPEC-212 T-007).
 *
 * Thin wrapper around {@link persistConversationTurn} that hardcodes
 * `feature='search'` and encodes an empty context note (the search feature
 * does not scope conversations to a single accommodation or other FK).
 *
 * ## Contract (best-effort, non-fatal)
 *
 *   - **First turn** (`conversationId === null`): creates a new
 *     `aiConversations` row with `feature='search'` and returns its id.
 *   - **Subsequent turn** (`conversationId` is a UUID): appends messages to
 *     the existing conversation and echoes the same id back.
 *   - **On any DB failure**: logs `apiLogger.error` and re-throws.
 *     The route handler wraps the call in a `Promise.race` against a 1500 ms
 *     timeout so failures/timeouts are swallowed and never break the SSE stream.
 *
 * @module apps/api/routes/ai/protected/search-chat.persistence
 */

import type { StreamTextFinalMeta } from '@repo/schemas';
import {
    type PersistConversationTurnOutput,
    persistConversationTurn
} from '../../../services/ai-chat-persistence.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Input contract for {@link persistSearchChatTurn}. */
export interface PersistSearchChatTurnInput {
    /** The authenticated user's id (FK → `users.id`). */
    readonly userId: string;
    /**
     * Existing conversation id to append to, or `null` for the first turn.
     * When `null`, a new `aiConversations` row is created with `feature='search'`.
     */
    readonly conversationId: string | null;
    /** The verbatim user turn text. */
    readonly userMessage: string;
    /** The verbatim assistant turn text (post-stream, accumulated). */
    readonly assistantMessage: string;
    /** Final stream metadata (provider, model, token usage) from the engine. */
    readonly meta: StreamTextFinalMeta;
}

/** Output contract for {@link persistSearchChatTurn}. */
export type PersistSearchChatTurnOutput = PersistConversationTurnOutput;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Persists a single conversational-search turn to the database.
 *
 * Wraps {@link persistConversationTurn} with `feature='search'` and an empty
 * context note (search conversations are not scoped to a single resource).
 *
 * @param input - User id, prior conversation id (or null), user/assistant
 *   message text, and the stream's final metadata.
 * @returns The conversation id (newly-created on first turn, echoed otherwise).
 * @throws Re-throws any DB error after logging. The route layer MUST swallow
 *   this throw so the SSE `done` event is still emitted.
 */
export async function persistSearchChatTurn(
    input: PersistSearchChatTurnInput
): Promise<PersistSearchChatTurnOutput> {
    return persistConversationTurn({
        userId: input.userId,
        feature: 'search',
        // Search conversations are not scoped to a single accommodation or
        // other FK. An empty JSON object is stored as the context note so
        // the column has a consistent, parseable value.
        contextNote: '{}',
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        assistantMessage: input.assistantMessage,
        meta: input.meta
    });
}
