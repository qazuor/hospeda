/**
 * Conversation persistence helpers for AI routes (SPEC-200 T-003, SPEC-212 T-007).
 *
 * ## Exports
 *
 * - {@link persistConversationTurn} — Generic, feature-agnostic helper that
 *   writes a user + assistant message pair to `aiConversations` / `aiMessages`.
 *   Accepts a `feature` parameter and an opaque `contextNote` JSON string.
 *
 * - {@link persistChatTurn} — Wrapper around `persistConversationTurn` for the
 *   accommodation-chat flow (SPEC-200). Hardcodes `feature='chat'` and encodes
 *   `accommodationId` into `contextNote`. API surface is backwards-compatible.
 *
 * ## Shared contract
 *
 *   - **First turn** (`conversationId === null`): INSERT one `aiConversations`
 *     row with the given `feature`, `title=null` (Q-R1), and the supplied
 *     `contextNote`. The new id is returned in the output and is what the SSE
 *     `done` frame rides on (per D-3 / AC-3.1).
 *   - **Subsequent turn** (`conversationId` is a UUID): SKIP the
 *     `aiConversations` insert. INSERT two `aiMessages` rows against the
 *     existing conversation (AC-3.2).
 *   - **Always** insert two `aiMessages` rows: one `user`, one `assistant`.
 *     The user row stores `provider=null, tokens=0`; the assistant row stores
 *     `provider=meta.provider, tokens=meta.usage.completionTokens`.
 *   - **On any DB failure** (in any of the three inserts), log
 *     `apiLogger.error` with the error context and re-throw. The CALLER
 *     (`meta.then` in the route handler) is responsible for swallowing the
 *     throw so the SSE `done` event is still emitted (AC-3.3 / AC-14).
 *
 * ## Implementation note
 *
 * Drizzle direct (`getDb()` from `@repo/db`); no model, no actor. This
 * is a one-off write helper, not CRUD. The `userId` is passed explicitly
 * to the helper instead of being threaded through an Actor — the auth
 * layer (which calls this helper) has already verified the user.
 *
 * @module apps/api/services/ai-chat-persistence
 */

import { aiConversations, aiMessages, getDb } from '@repo/db';
import type { AiFeature, StreamTextFinalMeta } from '@repo/schemas';
import { apiLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Generic persistence types
// ---------------------------------------------------------------------------

/** Input contract for {@link persistConversationTurn}. */
export interface PersistConversationTurnInput {
    /** The authenticated user's id (FK → `users.id`). */
    readonly userId: string;
    /** AI feature bucket for this conversation (e.g. `'chat'`, `'search'`). */
    readonly feature: AiFeature;
    /**
     * Opaque JSON string stored in the `contextNote` column.
     * Callers encode whatever feature-specific context they need
     * (e.g. `'{"accommodationId":"..."}'` for chat, or `'{}'` for search).
     */
    readonly contextNote: string;
    /**
     * Existing conversation id, or `null` for the first turn. When `null`,
     * a new `aiConversations` row is created; when a UUID, the helper
     * appends messages to that conversation only (AC-3.2).
     */
    readonly conversationId: string | null;
    /** The verbatim user turn text. */
    readonly userMessage: string;
    /** The verbatim assistant turn text (post-stream, accumulated). */
    readonly assistantMessage: string;
    /** Final stream metadata (provider, model, token usage) from the engine. */
    readonly meta: StreamTextFinalMeta;
}

/** Output contract for {@link persistConversationTurn} and {@link persistChatTurn}. */
export interface PersistConversationTurnOutput {
    /**
     * The conversation id — either the input (subsequent turn) or the
     * newly-created id (first turn). The route layer attaches this to
     * the SSE `done` frame on win of the 1500 ms race (D-3).
     */
    readonly conversationId: string;
}

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

/**
 * Persists a single conversation turn (user + assistant) to the database.
 *
 * Feature-agnostic: works for any AI feature that stores turns in
 * `aiConversations` + `aiMessages`. See module JSDoc for the full contract.
 *
 * @param input - Persistence inputs: user id, feature, context note, prior
 *   conversation id (or null for first turn), user/assistant message text,
 *   and the stream's final metadata.
 * @returns The conversation id used for both messages (newly-created or echoed).
 * @throws Re-throws any DB error after logging it with `apiLogger.error`.
 *   The route layer's `meta.then` callback MUST swallow this throw so
 *   the SSE `done` event is still emitted.
 */
export async function persistConversationTurn(
    input: PersistConversationTurnInput
): Promise<PersistConversationTurnOutput> {
    const { userId, feature, contextNote, conversationId, userMessage, assistantMessage, meta } =
        input;

    const db = getDb();
    let resolvedConversationId = conversationId;

    // -----------------------------------------------------------------------
    // Step 1 — First turn: create the aiConversations row.
    // -----------------------------------------------------------------------
    if (conversationId === null) {
        try {
            const rows = await db
                .insert(aiConversations)
                .values({
                    userId,
                    feature,
                    // Q-R1: title stays null in V1. Never set it from message
                    // content; V2 may add an engine-side title summarization.
                    title: null,
                    // Use the schema's `contextNote` JSON column to attach
                    // feature-specific context without a new FK migration (D-4).
                    contextNote
                })
                .returning({ id: aiConversations.id });
            const newId = rows[0]?.id;
            if (!newId) {
                throw new Error('persistConversationTurn: aiConversations insert returned no id');
            }
            resolvedConversationId = newId;
        } catch (error) {
            apiLogger.error(
                {
                    userId,
                    feature,
                    // Preserve feature-specific context (e.g. accommodationId for
                    // chat) in the error log without coupling to a feature.
                    contextNote,
                    error: error instanceof Error ? error.message : String(error)
                },
                'ai-chat-persistence: failed to insert aiConversations row (non-fatal, caller will swallow)'
            );
            throw error;
        }
    }

    if (resolvedConversationId === null) {
        throw new Error(
            'persistConversationTurn: resolvedConversationId must be set before inserting messages'
        );
    }

    // -----------------------------------------------------------------------
    // Step 2 — User message row.
    // -----------------------------------------------------------------------
    try {
        await db
            .insert(aiMessages)
            .values({
                conversationId: resolvedConversationId,
                role: 'user',
                content: userMessage,
                provider: null,
                tokens: 0
            })
            .returning({ id: aiMessages.id });
    } catch (error) {
        apiLogger.error(
            {
                userId,
                conversationId: resolvedConversationId,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-chat-persistence: failed to insert user aiMessages row (non-fatal, caller will swallow)'
        );
        throw error;
    }

    // -----------------------------------------------------------------------
    // Step 3 — Assistant message row.
    // -----------------------------------------------------------------------
    try {
        await db
            .insert(aiMessages)
            .values({
                conversationId: resolvedConversationId,
                role: 'assistant',
                content: assistantMessage,
                provider: meta.provider,
                tokens: meta.usage.completionTokens
            })
            .returning({ id: aiMessages.id });
    } catch (error) {
        apiLogger.error(
            {
                userId,
                conversationId: resolvedConversationId,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-chat-persistence: failed to insert assistant aiMessages row (non-fatal, caller will swallow)'
        );
        throw error;
    }

    return { conversationId: resolvedConversationId };
}

// ---------------------------------------------------------------------------
// Accommodation-chat types (SPEC-200, backwards-compatible surface)
// ---------------------------------------------------------------------------

/** Input contract for {@link persistChatTurn}. */
export interface PersistChatTurnInput {
    /** The authenticated user's id (FK → `users.id`). */
    readonly userId: string;
    /** The accommodation being chatted about (stored in `contextNote` JSON). */
    readonly accommodationId: string;
    /**
     * Existing conversation id, or `null` for the first turn. When `null`,
     * a new `aiConversations` row is created; when a UUID, the helper
     * appends messages to that conversation only (AC-3.2).
     */
    readonly conversationId: string | null;
    /** The verbatim user turn text (PII-scrubbed separately for telemetry; not here). */
    readonly userMessage: string;
    /** The verbatim assistant turn text (post-stream, accumulated). */
    readonly assistantMessage: string;
    /** Final stream metadata (provider, model, token usage) from the engine. */
    readonly meta: StreamTextFinalMeta;
}

/** Output contract for {@link persistChatTurn}. */
export type PersistChatTurnOutput = PersistConversationTurnOutput;

// ---------------------------------------------------------------------------
// Accommodation-chat wrapper (SPEC-200 T-003)
// ---------------------------------------------------------------------------

/**
 * Persists a single accommodation-chat turn to the database.
 *
 * Thin wrapper around {@link persistConversationTurn} that hardcodes
 * `feature='chat'` and serialises `accommodationId` into `contextNote`.
 * API surface is fully backwards-compatible with the pre-refactor version.
 *
 * See module JSDoc for the full contract.
 *
 * @param input - The actor's user id, the accommodation id, the prior
 *   `conversationId` (or `null` for the first turn), the user/assistant
 *   message text, and the stream's final metadata.
 * @returns The conversation id used for both messages (newly-created or echoed).
 * @throws Re-throws any DB error after logging it with `apiLogger.error`.
 */
export async function persistChatTurn(input: PersistChatTurnInput): Promise<PersistChatTurnOutput> {
    return persistConversationTurn({
        userId: input.userId,
        feature: 'chat',
        contextNote: JSON.stringify({ accommodationId: input.accommodationId }),
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        assistantMessage: input.assistantMessage,
        meta: input.meta
    });
}
