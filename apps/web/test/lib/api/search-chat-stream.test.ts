/**
 * @file search-chat-stream.test.ts
 * @description Unit tests for the SSE search-chat stream client (SPEC-212 T-008).
 *
 * Tests the native fetch + ReadableStream SSE parser that consumes
 * POST /api/v1/protected/ai/search-chat events.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamSearchChat } from '../../../src/lib/api/search-chat-stream';
import type { SearchChatSseEvent } from '../../../src/lib/api/search-chat-stream';

// --- Helpers ------------------------------------------------------------------

function createSseResponse(lines: string[], status = 200): Response {
    const body = lines.join('\n');
    return new Response(body, {
        status,
        headers: { 'Content-Type': 'text/event-stream' }
    });
}

function createJsonErrorResponse(status: number, message = 'Unauthorized'): Response {
    return new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

const SAMPLE_FILTERS_PAYLOAD = {
    params: {
        hasPool: 'true',
        minGuests: '4'
    },
    intent: {
        hasPool: true,
        minGuests: 4
    }
};

// --- Tests --------------------------------------------------------------------

describe('streamSearchChat (SSE client)', () => {
    const baseParams = {
        apiUrl: 'http://localhost:3001',
        messages: [{ role: 'user' as const, content: 'cabaña con pileta para 4 personas' }],
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
                        'event: filters',
                        `data: ${JSON.stringify(SAMPLE_FILTERS_PAYLOAD)}`,
                        '',
                        'event: token',
                        'data: {"delta":"Encontré cabañas"}',
                        '',
                        'event: token',
                        'data: {"delta":" con pileta."}',
                        '',
                        'event: done',
                        'data: {"conversationId":"550e8400-e29b-41d4-a716-446655440001"}',
                        ''
                    ])
                )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Happy-path frame ordering ──────────────────────────────────────────────

    it('parses filters, token, token, done events in correct order', async () => {
        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(4);
        expect(events[0]?.type).toBe('filters');
        expect(events[1]?.type).toBe('token');
        expect(events[2]?.type).toBe('token');
        expect(events[3]?.type).toBe('done');
    });

    // ── filters event ─────────────────────────────────────────────────────────

    it('parses filters event with params and intent', async () => {
        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        const filtersEvent = events[0];
        expect(filtersEvent?.type).toBe('filters');
        if (filtersEvent?.type !== 'filters') return;

        expect(filtersEvent.filters).toEqual(SAMPLE_FILTERS_PAYLOAD);
        expect(filtersEvent.filters.params).toEqual({ hasPool: 'true', minGuests: '4' });
        expect(filtersEvent.filters.intent).toEqual({ hasPool: true, minGuests: 4 });
    });

    // ── token events ──────────────────────────────────────────────────────────

    it('parses token events and yields correct deltas', async () => {
        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        const tokenEvents = events.filter((e) => e.type === 'token');
        expect(tokenEvents).toHaveLength(2);

        const [first, second] = tokenEvents;
        expect(first?.type === 'token' && first.delta).toBe('Encontré cabañas');
        expect(second?.type === 'token' && second.delta).toBe(' con pileta.');
    });

    // ── done event ────────────────────────────────────────────────────────────

    it('parses done event with conversationId', async () => {
        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        const doneEvent = events.at(-1);
        expect(doneEvent?.type).toBe('done');
        if (doneEvent?.type !== 'done') return;

        expect(doneEvent.conversationId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('parses done event with null conversationId', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse(['event: done', 'data: {"conversationId":null}', ''])
                )
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        const doneEvent = events[0];
        expect(doneEvent?.type).toBe('done');
        if (doneEvent?.type !== 'done') return;

        expect(doneEvent.conversationId).toBeNull();
    });

    // ── error SSE event ───────────────────────────────────────────────────────

    it('parses error SSE event with code and message', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: error',
                        'data: {"code":"PROVIDER_UNAVAILABLE","message":"AI service is down"}',
                        ''
                    ])
                )
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            type: 'error',
            code: 'PROVIDER_UNAVAILABLE',
            message: 'AI service is down'
        });
    });

    // ── HTTP / transport errors → stream_error ─────────────────────────────────

    it('emits stream_error on non-2xx response and does not parse SSE frames', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(createJsonErrorResponse(401, 'Unauthorized'))
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            type: 'stream_error',
            error: expect.objectContaining({ message: 'Unauthorized' })
        });
    });

    it('emits stream_error when fetch rejects (network error)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
            type: 'stream_error',
            error: expect.objectContaining({ message: 'fetch failed' })
        });
    });

    // ── Abort ─────────────────────────────────────────────────────────────────

    it('silently returns on abort with no event emitted', async () => {
        const controller = new AbortController();
        controller.abort();

        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({
            ...baseParams,
            onEvent: (e) => events.push(e),
            signal: controller.signal
        });

        expect(events).toHaveLength(0);
    });

    // ── Malformed / partial chunks ─────────────────────────────────────────────

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
                        'data: NOT_VALID_JSON',
                        '',
                        'event: done',
                        'data: {"conversationId":null}',
                        ''
                    ])
                )
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        // Malformed line is silently dropped; valid frames are emitted.
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: 'token', delta: 'Hello' });
        expect(events[1]).toEqual({ type: 'done', conversationId: null });
    });

    it('handles a data line that arrives without a preceding event line', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                createSseResponse([
                    // No "event:" prefix — data-only line must be ignored.
                    'data: {"delta":"orphan"}',
                    '',
                    'event: token',
                    'data: {"delta":"valid"}',
                    '',
                    'event: done',
                    'data: {"conversationId":null}',
                    ''
                ])
            )
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        // The orphan data line has no event type — must be ignored.
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: 'token', delta: 'valid' });
        expect(events[1]).toEqual({ type: 'done', conversationId: null });
    });

    it('silently ignores unknown event types (e.g. debug)', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: debug',
                        'data: {"info":"internal-trace"}',
                        '',
                        'event: token',
                        'data: {"delta":"visible"}',
                        '',
                        'event: done',
                        'data: {"conversationId":null}',
                        ''
                    ])
                )
        );

        const events: SearchChatSseEvent[] = [];
        await streamSearchChat({ ...baseParams, onEvent: (e) => events.push(e) });

        // debug event must be swallowed; only token + done surfaced.
        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: 'token', delta: 'visible' });
        expect(events[1]).toEqual({ type: 'done', conversationId: null });
    });

    // ── Request shape ─────────────────────────────────────────────────────────

    it('sends correct POST body including conversationId and currentFilters', async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);
        const filters = { hasPool: true, minGuests: 4 };

        await streamSearchChat({
            ...baseParams,
            conversationId: '550e8400-e29b-41d4-a716-446655440001',
            currentFilters: filters,
            onEvent: () => {}
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/protected/ai/search-chat',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    messages: baseParams.messages,
                    locale: 'es',
                    conversationId: '550e8400-e29b-41d4-a716-446655440001',
                    currentFilters: filters
                })
            })
        );
    });

    it('omits currentFilters from POST body when not provided', async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);

        await streamSearchChat({ ...baseParams, onEvent: () => {} });

        const callArgs = fetchSpy.mock.calls[0];
        const requestInit = callArgs?.[1] as RequestInit | undefined;
        const parsedBody = JSON.parse(requestInit?.body as string) as Record<string, unknown>;

        expect('currentFilters' in parsedBody).toBe(false);
    });

    it('sends conversationId as undefined (omitted from body) when null', async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);

        await streamSearchChat({ ...baseParams, conversationId: null, onEvent: () => {} });

        const callArgs = fetchSpy.mock.calls[0];
        const requestInit = callArgs?.[1] as RequestInit | undefined;
        const parsedBody = JSON.parse(requestInit?.body as string) as Record<string, unknown>;

        // null conversationId becomes undefined — JSON.stringify omits it from body.
        expect('conversationId' in parsedBody).toBe(false);
    });

    it('defaults locale to es when not provided', async () => {
        const fetchSpy = vi.mocked(globalThis.fetch);

        await streamSearchChat({
            apiUrl: 'http://localhost:3001',
            messages: baseParams.messages,
            conversationId: null,
            onEvent: () => {}
        });

        const callArgs = fetchSpy.mock.calls[0];
        const requestInit = callArgs?.[1] as RequestInit | undefined;
        const parsedBody = JSON.parse(requestInit?.body as string) as Record<string, unknown>;

        expect(parsedBody.locale).toBe('es');
    });
});
