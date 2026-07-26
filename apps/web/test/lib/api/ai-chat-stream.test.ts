/**
 * @file ai-chat-stream.test.ts
 * @description Unit tests for the SSE chat stream client (SPEC-200 REQ-200-6 AC-6.4).
 *
 * Tests the native fetch + ReadableStream SSE parser that consumes
 * POST /api/v1/protected/ai/chat events.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SseEvent } from '../../../src/lib/api/ai-chat-stream';
import { streamChat } from '../../../src/lib/api/ai-chat-stream';

// --- Helpers ---

function createSseResponse(lines: string[], status = 200): Response {
    const body = lines.join('\n');
    return new Response(body, {
        status,
        headers: { 'Content-Type': 'text/event-stream' }
    });
}

function createJsonErrorResponse(
    status: number,
    message = 'Unauthorized',
    code?: string
): Response {
    return new Response(JSON.stringify({ error: { ...(code ? { code } : {}), message } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/** A non-2xx with no parseable error body at all (gateway page, etc.). */
function createOpaqueErrorResponse(status: number): Response {
    return new Response('<html>gateway</html>', {
        status,
        headers: { 'Content-Type': 'text/html' }
    });
}

// --- Tests ---

describe('streamChat (SSE client)', () => {
    const baseParams = {
        apiUrl: 'http://localhost:3001',
        accommodationId: '550e8400-e29b-41d4-a716-446655440000',
        messages: [{ role: 'user' as const, content: '¿Tiene estacionamiento?' }],
        locale: 'es' as const,
        conversationId: null as string | null
    };

    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: token',
                        'data: {"delta":"Hola"}',
                        '',
                        'event: token',
                        'data: {"delta":", tenés parking."}',
                        '',
                        'event: done',
                        'data: {"usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15},"provider":"openai","model":"gpt-4o-mini","finishReason":"stop"}',
                        ''
                    ])
                )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parses token, token, done events from multi-line SSE', async () => {
        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toEqual([
            { type: 'token', delta: 'Hola' },
            { type: 'token', delta: ', tenés parking.' },
            {
                type: 'done',
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'openai',
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            }
        ]);
    });

    it('preserves the error code on a non-2xx response (HOS-292)', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createJsonErrorResponse(
                        403,
                        'accommodations.aiChat.unavailable',
                        'ENTITLEMENT_REQUIRED'
                    )
                )
        );

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        // This used to collapse into `stream_error` with a bare Error, throwing
        // the code away and leaving the widget holding a message that is an
        // i18n key — which it then rendered verbatim.
        expect(events).toEqual([
            {
                type: 'error',
                code: 'ENTITLEMENT_REQUIRED',
                message: 'accommodations.aiChat.unavailable'
            }
        ]);
    });

    it('still reports a structured error when the body carries no code', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(createJsonErrorResponse(401, 'Unauthorized'))
        );

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toEqual([
            { type: 'error', code: 'INTERNAL_ERROR', message: 'Unauthorized' }
        ]);
    });

    it('emits stream_error when the response has no parseable error body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createOpaqueErrorResponse(502)));

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            type: 'stream_error',
            error: expect.objectContaining({ message: 'HTTP 502' })
        });
    });

    it('emits stream_error when fetch rejects (network error)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            type: 'stream_error',
            error: expect.objectContaining({ message: 'fetch failed' })
        });
    });

    it('silently returns on abort (no stream_error)', async () => {
        const controller = new AbortController();
        // Abort immediately
        controller.abort();

        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
        );

        const events: SseEvent[] = [];
        await streamChat({
            ...baseParams,
            onEvent: (e) => events.push(e),
            signal: controller.signal
        });

        expect(events).toHaveLength(0);
    });

    it('parses error SSE event with code and message', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: error',
                        'data: {"code":"MODERATION_BLOCKED","message":"Content policy violation"}',
                        ''
                    ])
                )
        );

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toEqual([
            { type: 'error', code: 'MODERATION_BLOCKED', message: 'Content policy violation' }
        ]);
    });

    it('swallows malformed JSON lines without crashing', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: token',
                        'data: {"delta":"Hello"}',
                        '',
                        'event: token',
                        'data: NOT_JSON_AT_ALL',
                        '',
                        'event: done',
                        'data: {"usage":{"promptTokens":1,"completionTokens":1,"totalTokens":2},"provider":"openai","model":"gpt-4o-mini","finishReason":"stop"}',
                        ''
                    ])
                )
        );

        const events: SseEvent[] = [];
        await streamChat({ ...baseParams, onEvent: (e) => events.push(e) });

        // Only the valid token + done should be emitted; malformed line is swallowed
        expect(events).toEqual([
            { type: 'token', delta: 'Hello' },
            {
                type: 'done',
                usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
                provider: 'openai',
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            }
        ]);
    });

    it('sends correct POST body with credentials', async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);

        await streamChat({ ...baseParams, onEvent: () => {} });

        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/protected/ai/chat',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    accommodationId: baseParams.accommodationId,
                    messages: baseParams.messages,
                    locale: 'es',
                    conversationId: null
                })
            })
        );
    });
});
