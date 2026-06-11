import { z } from 'zod';
import { AccommodationSearchHttpSchema } from '../accommodation/accommodation.http.schema.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';
import { AI_CHAT_MAX_MESSAGES, AiChatMessageSchema } from './ai-chat.schema.js';
import { SearchIntentEntitiesSchema } from './ai-search-intent.schema.js';

/**
 * Schemas for the conversational AI accommodation search feature (SPEC-212).
 *
 * This feature turns SPEC-199's single-shot "natural language -> filters"
 * translator into a multi-turn conversational search. Each turn the protected
 * SSE route `POST /api/v1/protected/ai/search-chat`:
 *   1. extracts the full updated filter set via `generateObject`,
 *   2. emits a `filters` event with URL-ready accommodation search params, and
 *   3. streams a natural-language reply via `token` events, ending with `done`.
 *
 * The search itself stays the deterministic public accommodations endpoint — the
 * AI route never retrieves or ranks listings. These schemas are the single source
 * of truth shared by the API route and the web SSE client.
 *
 * Convention (matches the rest of the AI schemas): request schemas are `.strict()`,
 * event/output schemas are intentionally open. The message shape and the message
 * cap are reused from the SPEC-200 chat schemas; the filter slot bag is reused from
 * the SPEC-199 search-intent schemas.
 */

/**
 * Request body for a single conversational-search turn.
 *
 * The client echoes the conversation history on every request (V1 client-echo
 * model) and the accumulated filter set so the LLM can apply the new message as a
 * delta and return the complete updated set.
 *
 * @property messages - Prior turns plus the new user message (1..AI_CHAT_MAX_MESSAGES).
 * @property currentFilters - The accumulated filter slots from prior turns. Absent on the first turn.
 * @property locale - Reply + amenity-allowlist language. Defaults to `'es'`.
 * @property conversationId - Server conversation id from a previous turn's `done` event, when continuing. Nullable/optional because persistence is best-effort.
 */
export const AiSearchChatRequestSchema = z
    .object({
        messages: z.array(AiChatMessageSchema).min(1).max(AI_CHAT_MAX_MESSAGES),
        currentFilters: SearchIntentEntitiesSchema.optional(),
        locale: LanguageEnumSchema.optional().default('es'),
        conversationId: z.string().uuid().nullable().optional()
    })
    .strict();

export type AiSearchChatRequest = z.infer<typeof AiSearchChatRequestSchema>;

/**
 * Payload of the `filters` SSE event, emitted once per turn as soon as
 * `generateObject` resolves (before the reply streams, so results render first).
 *
 * @property params - URL-ready accommodation search params the frontend passes to `GET /api/v1/public/accommodations`.
 * @property intent - The full extracted filter slot bag, used to render the removable active-filter chips.
 */
export const AiSearchChatFiltersEventSchema = z.object({
    params: AccommodationSearchHttpSchema,
    intent: SearchIntentEntitiesSchema
});

export type AiSearchChatFiltersEvent = z.infer<typeof AiSearchChatFiltersEventSchema>;

/**
 * Payload of a `token` SSE event: one streamed chunk of the natural-language reply.
 * The reply does NOT cite an exact result count (the AI route never queries
 * accommodations — the UI shows the count after it searches).
 *
 * @property delta - The text chunk to append to the reply.
 */
export const AiSearchChatTokenEventSchema = z.object({
    delta: z.string()
});

export type AiSearchChatTokenEvent = z.infer<typeof AiSearchChatTokenEventSchema>;

/**
 * Payload of the terminal `done` SSE event.
 *
 * @property conversationId - The persisted conversation id, or `null` when best-effort persistence did not produce one.
 */
export const AiSearchChatDoneEventSchema = z.object({
    conversationId: z.string().uuid().nullable()
});

export type AiSearchChatDoneEvent = z.infer<typeof AiSearchChatDoneEventSchema>;

/**
 * Payload of an `error` SSE event (terminal). Emitted on provider failure or
 * validation error during a turn.
 *
 * @property code - Machine-readable error code.
 * @property message - Human-readable error description.
 */
export const AiSearchChatErrorEventSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1)
});

export type AiSearchChatErrorEvent = z.infer<typeof AiSearchChatErrorEventSchema>;

/**
 * Discriminated union of all SSE events a conversational-search turn can emit,
 * keyed by a `type` literal. Useful for the web SSE client when events carry their
 * type in-band; the individual payload schemas above cover the transport-level
 * form (SSE `event:` name + bare-payload `data:`).
 */
export const AiSearchChatSseEventSchema = z.discriminatedUnion('type', [
    AiSearchChatFiltersEventSchema.extend({ type: z.literal('filters') }),
    AiSearchChatTokenEventSchema.extend({ type: z.literal('token') }),
    AiSearchChatDoneEventSchema.extend({ type: z.literal('done') }),
    AiSearchChatErrorEventSchema.extend({ type: z.literal('error') })
]);

export type AiSearchChatSseEvent = z.infer<typeof AiSearchChatSseEventSchema>;
