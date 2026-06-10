/**
 * SSE streaming helper for the AI chat endpoint.
 *
 * Sends a POST to `/api/v1/protected/ai/chat` and parses the Server-Sent Events
 * stream, calling `onEvent` for each parsed event (token, done, error).
 */

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
    | { type: 'stream_error'; error: Error };

/**
 * Stream a chat message via SSE and emit parsed events.
 *
 * For the `chat` feature an `accommodationId` is required; omitting it triggers
 * an immediate error event. The stream is aborted when the provided `signal` fires.
 */
export async function streamChat(params: {
    readonly feature: string;
    readonly message: string;
    readonly accommodationId?: string;
    readonly onEvent: (event: SseEvent) => void;
    readonly signal?: AbortSignal;
}): Promise<void> {
    const baseUrl = getApiBaseUrl();

    const body: Record<string, unknown> = {
        messages: [{ role: 'user', content: params.message }],
        locale: 'es'
    };

    if (params.feature === 'chat' && params.accommodationId) {
        body.accommodationId = params.accommodationId;
    }

    if (params.feature === 'chat' && !params.accommodationId) {
        params.onEvent({
            type: 'error',
            code: 'MISSING_ACCOMMODATION_ID',
            message: 'El chat requiere un accommodationId.'
        });
        return;
    }

    try {
        const response = await fetch(`${baseUrl}/api/v1/protected/ai/chat`, {
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
