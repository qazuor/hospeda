/**
 * @file search-chat-stream.ts
 * @description SSE stream client for POST /api/v1/protected/ai/search-chat.
 * Uses native fetch + ReadableStream to consume Server-Sent Events.
 * No external dependencies (EventSource rejected — no POST support).
 *
 * Frame order per turn: `filters` (once) → `token` (N) → `done` (once).
 * On provider error: a single `error` frame with no `done` following.
 * Unknown frames (e.g. `debug`) are silently ignored.
 *
 * @module search-chat-stream
 */

import type {
    AiSearchChatDoneEvent,
    AiSearchChatErrorEvent,
    AiSearchChatFiltersEvent,
    AiSearchChatRequest
} from '@repo/schemas';

// ─── Public event union ────────────────────────────────────────────────────────

/**
 * Discriminated union of all SSE events the search-chat stream can emit.
 *
 * - `filters`: carries the extracted search params, intent entities, and
 *   optional confidence (SPEC-265 A1). Emitted once per turn, before any
 *   `token` frames.
 * - `token`: one streamed chunk of the natural-language reply.
 * - `done`: terminal success event. `conversationId` is nullable — the server
 *   emits `null` when best-effort persistence did not produce an id.
 * - `error`: terminal SSE-level error from the AI provider.
 * - `stream_error`: transport/fetch-level error (not an SSE `error` frame).
 *   Carries `status` (HTTP status code, or 0 for network-level failures) so
 *   the UI can classify 429 → rate-limit copy, 5xx → service-error copy, etc.
 *   (SPEC-265 C3).
 */
export type SearchChatSseEvent =
    | { readonly type: 'filters'; readonly filters: AiSearchChatFiltersEvent }
    | { readonly type: 'token'; readonly delta: string }
    | { readonly type: 'done'; readonly conversationId: string | null }
    | { readonly type: 'error'; readonly code: string; readonly message: string }
    | { readonly type: 'stream_error'; readonly error: Error; readonly status: number };

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Message shape accepted by the search-chat endpoint.
 * Mirrors `AiChatMessageSchema` from `@repo/schemas` without coupling
 * to the full schema package at the type level (plain structural typing).
 */
export interface SearchChatMessage {
    readonly role: 'user' | 'assistant';
    readonly content: string;
}

/**
 * Parameters for {@link streamSearchChat}.
 *
 * @property apiUrl - Base URL of the API server (e.g. `http://localhost:3001`).
 * @property messages - Conversation history including the new user message.
 * @property currentFilters - Accumulated filter slots from previous turns. Omit on the first turn.
 * @property locale - Reply and slot-extraction locale. Defaults to `'es'`.
 * @property conversationId - Server conversation id from the previous turn's `done` event. Null on first turn.
 * @property onEvent - Callback invoked for each parsed SSE event.
 * @property signal - Optional AbortSignal for cancellation.
 */
export interface StreamSearchChatParams {
    readonly apiUrl: string;
    readonly messages: ReadonlyArray<SearchChatMessage>;
    readonly currentFilters?: AiSearchChatRequest['currentFilters'];
    readonly locale?: 'es' | 'en' | 'pt';
    readonly conversationId: string | null;
    readonly onEvent: (event: SearchChatSseEvent) => void;
    readonly signal?: AbortSignal;
}

/**
 * Streams a conversational search turn via SSE from the protected AI search-chat endpoint.
 *
 * Opens a `POST /api/v1/protected/ai/search-chat` request with credentials,
 * reads the streamed SSE body, and calls `onEvent` for each parsed frame.
 *
 * Frame ordering contract:
 * 1. One `filters` event (search params + intent entities).
 * 2. Zero or more `token` events (reply text chunks).
 * 3. One `done` event (conversationId, possibly null).
 *
 * On provider error: a single `error` event, no `done`.
 * On transport/fetch error: a single `stream_error` event (not SSE-level).
 * On user abort: returns silently with no event.
 *
 * @param params - Stream configuration and event callback.
 * @returns Promise that resolves when the stream completes, errors, or is aborted.
 *
 * @example
 * ```ts
 * await streamSearchChat({
 *   apiUrl: 'http://localhost:3001',
 *   messages: [{ role: 'user', content: 'cabaña con pileta para 4 personas' }],
 *   locale: 'es',
 *   conversationId: null,
 *   onEvent(event) {
 *     if (event.type === 'filters') applyFilters(event.filters);
 *     if (event.type === 'token')   appendText(event.delta);
 *     if (event.type === 'done')    setConversationId(event.conversationId);
 *     if (event.type === 'error')   showError(event.message);
 *     if (event.type === 'stream_error') showError(event.error.message);
 *   }
 * });
 * ```
 */
export async function streamSearchChat(params: StreamSearchChatParams): Promise<void> {
    try {
        const body: AiSearchChatRequest = {
            messages: params.messages as AiSearchChatRequest['messages'],
            locale: params.locale ?? 'es',
            conversationId: params.conversationId ?? undefined,
            ...(params.currentFilters !== undefined
                ? { currentFilters: params.currentFilters }
                : {})
        };

        const response = await fetch(`${params.apiUrl}/api/v1/protected/ai/search-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
            signal: params.signal
        });

        if (!response.ok || !response.body) {
            const errBody = await response.json().catch(() => ({}));
            params.onEvent({
                type: 'stream_error',
                error: new Error(
                    (errBody as { error?: { message?: string } })?.error?.message ??
                        `HTTP ${response.status}`
                ),
                status: response.status
            });
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ') && currentEvent) {
                    const payloadStr = line.slice(6);
                    try {
                        const payload = JSON.parse(payloadStr) as Record<string, unknown>;

                        if (currentEvent === 'filters') {
                            params.onEvent({
                                type: 'filters',
                                filters: payload as AiSearchChatFiltersEvent
                            });
                        } else if (currentEvent === 'token') {
                            params.onEvent({
                                type: 'token',
                                delta: payload.delta as string
                            });
                        } else if (currentEvent === 'done') {
                            const donePayload = payload as AiSearchChatDoneEvent;
                            params.onEvent({
                                type: 'done',
                                conversationId: donePayload.conversationId
                            });
                        } else if (currentEvent === 'error') {
                            const errPayload = payload as AiSearchChatErrorEvent;
                            params.onEvent({
                                type: 'error',
                                code: errPayload.code,
                                message: errPayload.message
                            });
                        }
                        // Unknown events (e.g. 'debug') are silently ignored.
                    } catch {
                        // Malformed JSON line — swallow and continue.
                    }
                    currentEvent = '';
                }
            }
        }
    } catch (err) {
        // AbortError means user-initiated cancellation — return silently.
        if (err instanceof DOMException && err.name === 'AbortError') {
            return;
        }
        // All other errors surface as stream_error.
        params.onEvent({
            type: 'stream_error',
            error: err instanceof Error ? err : new Error(String(err)),
            status: 0
        });
    }
}
