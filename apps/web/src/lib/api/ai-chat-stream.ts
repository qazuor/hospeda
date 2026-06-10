/**
 * @file ai-chat-stream.ts
 * @description SSE chat stream client for POST /api/v1/protected/ai/chat.
 * Uses native fetch + ReadableStream to consume Server-Sent Events.
 * No external dependencies (EventSource rejected — no POST support).
 *
 * @module ai-chat-stream
 */

/** SSE event types emitted by the chat stream. */
export type SseEvent =
    | { readonly type: 'token'; readonly delta: string }
    | {
          readonly type: 'done';
          readonly usage: {
              readonly promptTokens: number;
              readonly completionTokens: number;
              readonly totalTokens: number;
          };
          readonly provider: string;
          readonly model: string;
          readonly finishReason: string;
          readonly conversationId?: string;
      }
    | { readonly type: 'error'; readonly code: string; readonly message: string }
    | { readonly type: 'stream_error'; readonly error: Error };

/** Parameters for the streamChat function. */
export interface StreamChatParams {
    readonly apiUrl: string;
    readonly accommodationId: string;
    readonly messages: ReadonlyArray<{
        readonly role: 'user' | 'assistant';
        readonly content: string;
    }>;
    readonly locale: 'es' | 'en' | 'pt';
    readonly conversationId: string | null;
    readonly onEvent: (event: SseEvent) => void;
    readonly signal?: AbortSignal;
}

/**
 * Streams a chat completion via SSE from the protected AI chat endpoint.
 *
 * @param params - Stream parameters including API URL, messages, and event callback.
 * @returns Promise that resolves when the stream completes or is aborted.
 */
export async function streamChat(params: StreamChatParams): Promise<void> {
    try {
        const response = await fetch(`${params.apiUrl}/api/v1/protected/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                accommodationId: params.accommodationId,
                messages: params.messages,
                locale: params.locale,
                conversationId: params.conversationId
            }),
            signal: params.signal
        });

        if (!response.ok || !response.body) {
            const errBody = await response.json().catch(() => ({}));
            params.onEvent({
                type: 'stream_error',
                error: new Error(
                    (errBody as { error?: { message?: string } })?.error?.message ??
                        `HTTP ${response.status}`
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
                    const payloadStr = line.slice(6);
                    try {
                        const payload = JSON.parse(payloadStr) as Record<string, unknown>;

                        if (currentEvent === 'token') {
                            params.onEvent({
                                type: 'token',
                                delta: payload.delta as string
                            });
                        } else if (currentEvent === 'done') {
                            params.onEvent({
                                type: 'done',
                                usage: payload.usage as SseEvent extends {
                                    type: 'done';
                                }
                                    ? {
                                          promptTokens: number;
                                          completionTokens: number;
                                          totalTokens: number;
                                      }
                                    : never,
                                provider: payload.provider as string,
                                model: payload.model as string,
                                finishReason: payload.finishReason as string,
                                ...(payload.conversationId
                                    ? {
                                          conversationId: payload.conversationId as string
                                      }
                                    : {})
                            });
                        } else if (currentEvent === 'error') {
                            params.onEvent({
                                type: 'error',
                                code: payload.code as string,
                                message: payload.message as string
                            });
                        }
                    } catch {
                        // Malformed JSON line — swallow and continue
                    }
                    currentEvent = '';
                }
            }
        }
    } catch (err) {
        // AbortError means user-initiated cancellation — silently return
        if (err instanceof DOMException && err.name === 'AbortError') {
            return;
        }
        // Other errors emit stream_error
        params.onEvent({
            type: 'stream_error',
            error: err instanceof Error ? err : new Error(String(err))
        });
    }
}
