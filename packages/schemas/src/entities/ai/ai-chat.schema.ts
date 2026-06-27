import { z } from 'zod';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';
import { StreamTextFinalMetaSchema } from './ai-capability.schema.js';

/**
 * AI accommodation-chat HTTP request/response schemas (SPEC-200).
 *
 * Models the input contract for `POST /api/v1/protected/ai/chat` (the
 * tourist-facing multi-turn assistant on accommodation detail pages) plus
 * the additive `conversationId` extension on the `done` SSE frame emitted
 * by the streaming route factory.
 *
 * **Architecture role (SPEC-200 §3.4, §7)**:
 *
 * - The HTTP route validates the request body with `AiChatRequestSchema`.
 * - The streaming route factory's `meta` promise resolves to a value that
 *   extends `StreamTextFinalMetaSchema` (from SPEC-173) with the new
 *   optional `conversationId` field; this module re-exports that extended
 *   shape as `AiChatStreamFinalMetaSchema` so the route and any cross-stack
 *   consumers can type the `done` payload.
 * - The client-side SSE parser (`apps/web/src/lib/api/ai-chat-stream.ts`)
 *   lives OUTSIDE `@repo/schemas` per design §3.4 (wire format documented
 *   where it is consumed, not as a cross-stack dependency).
 *
 * **Message role scope (V1)**: HTTP request messages are restricted to
 * `'user' | 'assistant'`. The `'system'` role is server-only — the route
 * prepends a `messages[0].role === 'system'` block to invoke the engine's
 * caller-wins injection rule (`packages/ai-core/src/engine/ai-service.ts`).
 * Clients MUST NOT send `role: 'system'`; the schema enforces this.
 *
 * **Cap (Q-5 resolved)**: `messages.length` is bounded `[1, 20]`. A request
 * with more than 20 messages is rejected at the route boundary (HTTP 400).
 *
 * **Locale reuse**: `LanguageEnumSchema` from
 * `src/entities/user/user.settings.schema.ts` is the platform SSoT
 * (`'es' | 'en' | 'pt'`). Reused here, never re-declared. Defaults to `'es'`
 * per design §3.1 when the client omits it (the Argentine market default).
 *
 * **conversationId lifecycle (Q-1 / design §3.3)**:
 * - Absent or `null` in the request → first turn; the persistence helper
 *   INSERTs a new `aiConversations` row.
 * - A valid UUID in the request → subsequent turn; the persistence helper
 *   INSERTs only into `aiMessages` (no new `aiConversations` row).
 * - The `done` SSE event payload carries `conversationId` ONLY if the
 *   persistence race completes within 1500 ms; otherwise the field is
 *   omitted (V1 trade-off, owner-approved 2026-06-05).
 *
 * **Strictness**: request schemas use `.strict()` to reject unknown keys
 * at the API boundary (defence-in-depth for the multi-turn contract). The
 * `done` payload schema is intentionally NOT strict (mirrors
 * `StreamTextFinalMetaSchema` in `ai-capability.schema.ts` — server-emitted
 * shapes may grow additively without breaking clients that ignore unknown
 * keys).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of messages allowed in a single chat request body.
 *
 * **Owner-approved 2026-06-05 (Q-5 resolved)**: the V1 cap is 20 messages
 * (10 exchanges). The cap bounds per-call token spend and gives the
 * frontend a clear "Nueva conversación" UX on `at_cap`. A request with
 * more than 20 messages is rejected by `AiChatRequestSchema` with HTTP
 * 400 (`VALIDATION_ERROR`).
 *
 * The route handler also reads this constant to fire the
 * `ai_chat_cap_reached` PostHog event exactly when the client submits
 * 20 messages (AC-8.5 / design §6.5). Keep the schema-level `.max(...)`
 * and the route-level check in lock-step by importing this constant
 * from one place.
 */
export const AI_CHAT_MAX_MESSAGES = 20;

// ---------------------------------------------------------------------------
// Message (HTTP request shape — V1 role subset)
// ---------------------------------------------------------------------------

/**
 * A single message in a chat request body (V1 HTTP shape).
 *
 * Roles: `'user' | 'assistant'`. The `'system'` role is reserved for the
 * server-prepended context block (see module docstring) and is rejected at
 * the boundary to prevent client-side prompt injection.
 *
 * `content` must be a non-empty string — empty messages confuse the model
 * and would produce a no-op turn.
 */
export const AiChatMessageSchema = z
    .object({
        /**
         * The role of the message author.
         * Restricted to `'user' | 'assistant'`; `'system'` is server-only.
         */
        role: z.enum(['user', 'assistant']),
        /**
         * The text content of the message.
         * Must be a non-empty string, max 500 characters (SPEC-265 C2).
         * The cap bounds token spend and matches the client-side textarea
         * `maxLength` + char counter. Enforced at the schema boundary so
         * both the search-chat and accommodation-chat routes reject overlong
         * messages with HTTP 400 (`VALIDATION_ERROR`).
         */
        content: z.string().min(1).max(500)
    })
    .strict();

/** TypeScript type for a single chat request message. */
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

/**
 * Request body for `POST /api/v1/protected/ai/chat`.
 *
 * Validation contract:
 *
 * - `accommodationId` is a required UUID — the route resolves it to a 404
 *   pre-stream when not found (AC-9).
 * - `messages` must contain 1 to 20 entries (Q-5 cap). The route returns
 *   HTTP 400 (not 422) when the array exceeds 20 (AC-11).
 * - `locale` is optional and defaults to `'es'`. The route forwards the
 *   resolved value to the system-prompt resolver and to the SSE event
 *   metadata (AC-8).
 * - `conversationId` is optional and nullable. `null`/absent = first turn;
 *   a valid UUID = subsequent turn. Non-UUID strings are rejected.
 * - `.strict()` rejects unknown keys at the boundary.
 */
export const AiChatRequestSchema = z
    .object({
        /**
         * UUID of the accommodation the chat is about.
         * Drives context assembly (markdown block from accommodation + FAQs)
         * and 404 handling pre-stream.
         */
        accommodationId: z.string().uuid(),
        /**
         * Ordered multi-turn message array.
         * Minimum 1 (a request with no messages is meaningless), maximum 20
         * (Q-5 cap to bound token spend per call).
         */
        messages: z.array(AiChatMessageSchema).min(1).max(AI_CHAT_MAX_MESSAGES),
        /**
         * Target locale for the assistant reply.
         * Defaults to `'es'` (Argentine market default) when omitted.
         * Reused from the platform-wide `LanguageEnumSchema`.
         */
        locale: LanguageEnumSchema.optional().default('es'),
        /**
         * Conversation tracking ID.
         * - `undefined` (absent) — treated as a first turn.
         * - `null` — client explicitly signals first turn (equivalent to absent).
         * - Valid UUID — subsequent turn; server INSERTs only into `aiMessages`.
         *
         * The server does NOT load history from DB on subsequent turns (V1
         * limitation, R-7); the client MUST echo the full message history.
         */
        conversationId: z.string().uuid().nullable().optional()
    })
    .strict();

/** TypeScript type for the chat request body. */
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

// ---------------------------------------------------------------------------
// `done` SSE event payload — extends StreamTextFinalMeta with conversationId?
// ---------------------------------------------------------------------------

/**
 * Payload of the `event: done` SSE frame emitted by
 * `POST /api/v1/protected/ai/chat` at the end of a successful stream.
 *
 * Extends `StreamTextFinalMetaSchema` (SPEC-173) additively with an
 * optional `conversationId` field. The route fills `conversationId` ONLY
 * when the post-stream persistence race (1500 ms) completes before the
 * `meta` promise resolves; otherwise the field is absent and the client
 * treats the next request as a first turn (V1 trade-off, owner-approved).
 *
 * **Not `.strict()`** — mirrors the convention in `ai-capability.schema.ts`
 * for response shapes (line 32-33: "response schemas are intentionally
 * NOT `.strict()` — provider adapters may attach diagnostic fields that
 * the caller can ignore"). Future server-side additive fields will not
 * break clients that ignore unknown keys.
 */
export const AiChatStreamFinalMetaSchema = StreamTextFinalMetaSchema.extend({
    /**
     * Conversation tracking ID, present only when the post-stream
     * persistence helper completes within the 1500 ms race window.
     * Absent on timeout (V1 trade-off).
     */
    conversationId: z.string().uuid().optional()
});

/** TypeScript type for the `done` SSE event payload. */
export type AiChatStreamFinalMeta = z.infer<typeof AiChatStreamFinalMetaSchema>;
