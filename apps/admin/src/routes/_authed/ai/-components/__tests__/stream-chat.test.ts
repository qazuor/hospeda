/**
 * Unit tests for the AI Playground SSE routing helper (fix/ai-playground-search-routing).
 *
 * Regression coverage for the bug where `streamChat` unconditionally POSTed
 * to `/api/v1/protected/ai/chat` (which `.strict()`-requires `accommodationId`)
 * even when the selected feature was `search` — the real search endpoint
 * (`/api/v1/protected/ai/search-chat`) was never called and every search
 * request 400'd.
 *
 * Asserts:
 * - `feature === 'search'` POSTs to `/search-chat` with a body that has NO
 *   `accommodationId` and matches `AiSearchChatRequestSchema` (messages, locale).
 * - `feature === 'chat'` still POSTs to `/chat` with `accommodationId`.
 * - `feature === 'chat'` without an `accommodationId` never calls fetch and
 *   emits an immediate `MISSING_ACCOMMODATION_ID` error (pre-existing guard).
 * - The `filters` SSE frame emitted by `/search-chat` is parsed into a
 *   `{ type: 'filters', data }` event.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SseEvent } from '../stream-chat';
import { streamChat } from '../stream-chat';

// --- Helpers ------------------------------------------------------------------

function createSseResponse(lines: string[], status = 200): Response {
    const body = lines.join('\n');
    return new Response(body, {
        status,
        headers: { 'Content-Type': 'text/event-stream' }
    });
}

const SAMPLE_FILTERS_PAYLOAD = {
    params: { hasPool: 'true', minGuests: '4' },
    intent: { hasPool: true, minGuests: 4 },
    confidence: 0.82
};

describe('streamChat (playground SSE routing)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    // ── search feature routes to /search-chat ──────────────────────────────────

    describe('feature: search', () => {
        let fetchMock: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            fetchMock = vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: filters',
                        `data: ${JSON.stringify(SAMPLE_FILTERS_PAYLOAD)}`,
                        '',
                        'event: token',
                        'data: {"delta":"Encontré cabañas con pileta."}',
                        '',
                        'event: done',
                        'data: {"conversationId":"550e8400-e29b-41d4-a716-446655440001"}',
                        ''
                    ])
                );
            vi.stubGlobal('fetch', fetchMock);
        });

        it('POSTs to /api/v1/protected/ai/search-chat, not /chat', async () => {
            const events: SseEvent[] = [];
            await streamChat({
                feature: 'search',
                message: 'cabaña con pileta para 4 personas',
                onEvent: (e) => events.push(e)
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://localhost:3001/api/v1/protected/ai/search-chat');
        });

        it('sends a body with NO accommodationId, matching AiSearchChatRequestSchema shape', async () => {
            await streamChat({
                feature: 'search',
                message: 'cabaña con pileta para 4 personas',
                accommodationId: 'should-be-ignored-for-search',
                onEvent: () => {}
            });

            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;

            expect(sentBody).toEqual({
                messages: [{ role: 'user', content: 'cabaña con pileta para 4 personas' }],
                locale: 'es'
            });
            expect(sentBody.accommodationId).toBeUndefined();
        });

        it('parses the filters SSE frame into a filters event', async () => {
            const events: SseEvent[] = [];
            await streamChat({
                feature: 'search',
                message: 'cabaña con pileta para 4 personas',
                onEvent: (e) => events.push(e)
            });

            expect(events[0]).toEqual({ type: 'filters', data: SAMPLE_FILTERS_PAYLOAD });
            expect(events.some((e) => e.type === 'token')).toBe(true);
            expect(events.some((e) => e.type === 'done')).toBe(true);
        });
    });

    // ── chat feature keeps the pre-existing /chat contract ──────────────────────

    describe('feature: chat', () => {
        let fetchMock: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            fetchMock = vi
                .fn()
                .mockResolvedValue(
                    createSseResponse([
                        'event: token',
                        'data: {"delta":"Hola"}',
                        '',
                        'event: done',
                        'data: {"provider":"openai","model":"gpt-4o-mini","finishReason":"stop"}',
                        ''
                    ])
                );
            vi.stubGlobal('fetch', fetchMock);
        });

        it('POSTs to /api/v1/protected/ai/chat with accommodationId', async () => {
            await streamChat({
                feature: 'chat',
                message: 'hola',
                accommodationId: '11111111-1111-1111-1111-111111111111',
                onEvent: () => {}
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://localhost:3001/api/v1/protected/ai/chat');

            const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
            expect(sentBody).toEqual({
                messages: [{ role: 'user', content: 'hola' }],
                locale: 'es',
                accommodationId: '11111111-1111-1111-1111-111111111111'
            });
        });

        it('emits an immediate error and never calls fetch when accommodationId is missing', async () => {
            const events: SseEvent[] = [];
            await streamChat({
                feature: 'chat',
                message: 'hola',
                onEvent: (e) => events.push(e)
            });

            expect(fetchMock).not.toHaveBeenCalled();
            expect(events).toEqual([
                {
                    type: 'error',
                    code: 'MISSING_ACCOMMODATION_ID',
                    message: 'El chat requiere un accommodationId.'
                }
            ]);
        });
    });

    // ── other features keep the /chat body shape (no accommodationId) ──────────

    describe('feature: other (e.g. support)', () => {
        it('POSTs to /chat without accommodationId even when one is passed', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValue(createSseResponse(['event: done', 'data: {}', '']));
            vi.stubGlobal('fetch', fetchMock);

            await streamChat({
                feature: 'support',
                message: 'ayuda',
                accommodationId: 'ignored-for-non-chat-features',
                onEvent: () => {}
            });

            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://localhost:3001/api/v1/protected/ai/chat');
            const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
            expect(sentBody.accommodationId).toBeUndefined();
        });
    });
});
