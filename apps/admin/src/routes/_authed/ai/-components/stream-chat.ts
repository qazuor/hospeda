/**
 * SSE streaming helpers for the AI Playground.
 *
 * Routes each request to the correct API endpoint depending on the selected
 * `AiFeatureId`:
 *
 * - `search` -> `POST /api/v1/protected/ai/search-chat`. Body matches
 *   `AiSearchChatRequestSchema` (`.strict()`, NO `accommodationId`). SSE frame
 *   order: `filters` (once) -> `token` (N) -> `done` -> optional `error`.
 * - every other feature (`chat`, ...) -> `POST /api/v1/protected/ai/chat`.
 *   Body matches `AiChatRequestSchema` (`.strict()`, `accommodationId`
 *   required for `chat`). SSE frame order: `debug` -> `token` (N) -> `done`
 *   -> optional `error`.
 *
 * Both endpoints share the same transport-level shape (native `fetch` +
 * `ReadableStream` SSE parsing), so a single parser loop is reused and simply
 * dispatches on the `event:` line name.
 */

import type { AiSearchChatFiltersEvent } from '@repo/schemas';

function getApiBaseUrl(): string {
    const url = (import.meta.env as Record<string, string | undefined>).VITE_API_URL;
    if (!url) {
        throw new Error('[admin] VITE_API_URL is not configured.');
    }
    return url.replace(/\/$/, '');
}

/** Discriminated union of SSE events emitted by the stream parser. */
export type SseEvent =
    | { type: 'token'; delta: string }
    | { type: 'done'; data: Record<string, unknown> }
    | { type: 'error'; code: string; message: string }
    | { type: 'debug'; data: Record<string, unknown> }
    | { type: 'filters'; data: AiSearchChatFiltersEvent }
    | { type: 'stream_error'; error: Error };

const CHAT_ENDPOINT = '/api/v1/protected/ai/chat';
const SEARCH_CHAT_ENDPOINT = '/api/v1/protected/ai/search-chat';

/**
 * Builds the `{ endpoint, body }` pair for a single playground request,
 * routed by feature.
 *
 * `search` always targets `search-chat` with the `AiSearchChatRequestSchema`
 * body shape (no `accommodationId` — that field does not exist on that
 * schema and would fail `.strict()` validation). Every other feature keeps
 * the pre-existing `/chat` body shape, including the `accommodationId`
 * requirement for `chat`.
 */
function buildRequest(params: {
    readonly feature: string;
    readonly message: string;
    readonly accommodationId?: string;
}): { readonly endpoint: string; readonly body: Record<string, unknown> } {
    if (params.feature === 'search') {
        return {
            endpoint: SEARCH_CHAT_ENDPOINT,
            body: {
                messages: [{ role: 'user', content: params.message }],
                locale: 'es'
            }
        };
    }

    const body: Record<string, unknown> = {
        messages: [{ role: 'user', content: params.message }],
        locale: 'es'
    };

    if (params.feature === 'chat' && params.accommodationId) {
        body.accommodationId = params.accommodationId;
    }

    return { endpoint: CHAT_ENDPOINT, body };
}

/**
 * Stream a chat message via SSE and emit parsed events.
 *
 * For the `chat` feature an `accommodationId` is required; omitting it triggers
 * an immediate error event. The `search` feature never sends `accommodationId`
 * (it is routed to `/search-chat` instead of `/chat`). The stream is aborted
 * when the provided `signal` fires.
 */
export async function streamChat(params: {
    readonly feature: string;
    readonly message: string;
    readonly accommodationId?: string;
    readonly onEvent: (event: SseEvent) => void;
    readonly signal?: AbortSignal;
}): Promise<void> {
    if (params.feature === 'chat' && !params.accommodationId) {
        params.onEvent({
            type: 'error',
            code: 'MISSING_ACCOMMODATION_ID',
            message: 'El chat requiere un accommodationId.'
        });
        return;
    }

    const baseUrl = getApiBaseUrl();
    const { endpoint, body } = buildRequest(params);

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
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
                    (errBody as Record<string, unknown>)?.error
                        ? ((
                              (errBody as Record<string, Record<string, unknown>>).error as Record<
                                  string,
                                  unknown
                              >
                          ).message as string)
                        : `HTTP ${response.status}`
                )
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
                    try {
                        const payload = JSON.parse(line.slice(6));
                        if (currentEvent === 'token') {
                            params.onEvent({ type: 'token', delta: payload.delta });
                        } else if (currentEvent === 'done') {
                            params.onEvent({ type: 'done', data: payload });
                        } else if (currentEvent === 'debug') {
                            params.onEvent({ type: 'debug', data: payload });
                        } else if (currentEvent === 'filters') {
                            params.onEvent({
                                type: 'filters',
                                data: payload as AiSearchChatFiltersEvent
                            });
                        } else if (currentEvent === 'error') {
                            params.onEvent({
                                type: 'error',
                                code: payload.code,
                                message: payload.message
                            });
                        }
                    } catch {
                        // Malformed JSON — swallow and continue
                    }
                    currentEvent = '';
                }
            }
        }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return;
        }
        params.onEvent({
            type: 'stream_error',
            error: err instanceof Error ? err : new Error(String(err))
        });
    }
}
