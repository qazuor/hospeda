/**
 * @file useSearchChat.test.ts
 * @description Unit tests for the useSearchChat hook (SPEC-212 T-009).
 *
 * Covers:
 * - send() fires accommodations GET when `filters` event arrives (with the event params).
 * - Filters accumulate across turns (second send echoes prior currentFilters).
 * - token deltas accumulate into currentReply; done finalizes assistant message
 *   and stores conversationId.
 * - null conversationId from done is stored and NOT passed on the next turn.
 * - error / stream_error sets error state without throwing.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchChat } from '@/components/ai-search/useSearchChat';
import type { SearchChatSseEvent } from '@/lib/api/search-chat-stream';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStreamSearchChat = vi.fn();
const mockAccommodationsList = vi.fn();

vi.mock('@/lib/api/search-chat-stream', () => ({
    streamSearchChat: (...args: unknown[]) => mockStreamSearchChat(...args)
}));

vi.mock('@/lib/api/endpoints', () => ({
    accommodationsApi: {
        list: (...args: unknown[]) => mockAccommodationsList(...args)
    }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_API_URL = 'http://localhost:3001';
const CONV_ID = '550e8400-e29b-41d4-a716-446655440001';

const baseParams = {
    apiUrl: TEST_API_URL,
    locale: 'es' as const
};

/** Minimal SearchIntentEntities for the intent slot. */
const makeIntent = (overrides = {}) => ({
    minGuests: 4,
    hasPool: true,
    ...overrides
});

/** Minimal AccommodationSearchHttp params (post-Zod coercion). */
const makeSearchParams = (overrides = {}) => ({
    minGuests: 4,
    hasPool: true,
    ...overrides
});

/** Build a synthetic `filters` event. */
function makeFiltersEvent(overrides = {}): Extract<SearchChatSseEvent, { type: 'filters' }> {
    return {
        type: 'filters',
        filters: {
            params: makeSearchParams(overrides) as unknown as Extract<
                SearchChatSseEvent,
                { type: 'filters' }
            >['filters']['params'],
            intent: makeIntent(overrides)
        }
    };
}

/** Paginated accommodation list response. */
const makeAccommodationsResponse = () => ({
    ok: true as const,
    data: {
        items: [
            {
                id: 'acc-1',
                name: 'Cabaña del Río',
                slug: 'cabana-del-rio'
            }
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
    }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSearchChat', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockStreamSearchChat.mockReset();
        mockAccommodationsList.mockReset();
        mockAccommodationsList.mockResolvedValue(makeAccommodationsResponse());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ── Initial state ────────────────────────────────────────────────────────

    it('has correct initial state', () => {
        const { result } = renderHook(() => useSearchChat(baseParams));

        expect(result.current.messages).toEqual([]);
        expect(result.current.currentFilters).toBeNull();
        expect(result.current.results).toEqual([]);
        expect(result.current.resultsLoading).toBe(false);
        expect(result.current.currentReply).toBe('');
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.conversationId).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.hasSearched).toBe(false);
    });

    // ── hasSearched flag (empty-results UX) ──────────────────────────────────

    it('sets hasSearched to true as soon as the first accommodations GET fires', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        expect(result.current.hasSearched).toBe(false);

        await act(async () => {
            result.current.send('cabaña con pileta');
        });

        expect(result.current.hasSearched).toBe(true);
    });

    it('keeps hasSearched true when a search resolves with zero results', async () => {
        mockAccommodationsList.mockReset();
        mockAccommodationsList.mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
        });

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('algo muy específico que no existe');
        });

        expect(result.current.results).toEqual([]);
        expect(result.current.resultsLoading).toBe(false);
        expect(result.current.hasSearched).toBe(true);
    });

    // ── filters event fires accommodations GET ───────────────────────────────

    it('fires accommodations GET with params from the filters event', async () => {
        const filtersEvent = makeFiltersEvent();

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(filtersEvent);
            p.onEvent({ type: 'token', delta: 'Encontré ' });
            p.onEvent({ type: 'token', delta: '3 opciones.' });
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña con pileta para 4 personas');
        });

        // accommodationsApi.list should have been called once with the filter params
        expect(mockAccommodationsList).toHaveBeenCalledOnce();
        const calledWith = mockAccommodationsList.mock.calls[0][0] as Record<string, unknown>;
        expect(calledWith.minGuests).toBe(4);
        expect(calledWith.hasPool).toBe(true);
    });

    // ── nearbyDestinations from the filters event (HOS-111 T-014, G-9) ──────

    it('stores nearbyDestinations from a filters event that carries an expansion', async () => {
        const filtersEvent: Extract<SearchChatSseEvent, { type: 'filters' }> = {
            type: 'filters',
            filters: {
                params: makeSearchParams() as unknown as Extract<
                    SearchChatSseEvent,
                    { type: 'filters' }
                >['filters']['params'],
                intent: makeIntent(),
                nearbyDestinations: [
                    { id: 'dest-1', name: 'Pueblo Liebig', slug: 'pueblo-liebig' },
                    { id: 'dest-2', name: 'San José', slug: 'san-jose' }
                ]
            }
        };

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(filtersEvent);
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña en Colón, y también en destinos cercanos');
        });

        expect(result.current.nearbyDestinations).toEqual([
            { id: 'dest-1', name: 'Pueblo Liebig', slug: 'pueblo-liebig' },
            { id: 'dest-2', name: 'San José', slug: 'san-jose' }
        ]);
    });

    it('resets nearbyDestinations to [] on a later filters event that carries none (does not linger)', async () => {
        const expansionEvent: Extract<SearchChatSseEvent, { type: 'filters' }> = {
            type: 'filters',
            filters: {
                params: makeSearchParams() as unknown as Extract<
                    SearchChatSseEvent,
                    { type: 'filters' }
                >['filters']['params'],
                intent: makeIntent(),
                nearbyDestinations: [{ id: 'dest-1', name: 'Pueblo Liebig', slug: 'pueblo-liebig' }]
            }
        };

        mockStreamSearchChat.mockImplementationOnce(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(expansionEvent);
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('y también en destinos cercanos');
        });
        expect(result.current.nearbyDestinations).toHaveLength(1);

        // Next (unrelated, non-expansion) turn: filters event with no nearbyDestinations.
        mockStreamSearchChat.mockImplementationOnce(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        await act(async () => {
            result.current.send('más barata');
        });

        expect(result.current.nearbyDestinations).toEqual([]);
    });

    // ── tokens accumulate into currentReply; done finalizes ─────────────────

    it('token deltas accumulate into currentReply; done finalizes assistant message', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'token', delta: 'Encontré ' });
            p.onEvent({ type: 'token', delta: '3 opciones.' });
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña con pileta para 4 personas');
        });

        // After done: assistant message appended, reply cleared, streaming stopped.
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0]).toEqual({
            role: 'user',
            content: 'cabaña con pileta para 4 personas'
        });
        expect(result.current.messages[1]).toEqual({
            role: 'assistant',
            content: 'Encontré 3 opciones.'
        });
        expect(result.current.currentReply).toBe('');
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.conversationId).toBe(CONV_ID);
    });

    // ── conversationId stored and threaded ───────────────────────────────────

    it('stores conversationId from done and passes it on next turn', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('primera consulta');
        });

        expect(result.current.conversationId).toBe(CONV_ID);

        // Second turn: conversationId should be passed to streamSearchChat.
        await act(async () => {
            result.current.send('segunda consulta');
        });

        const secondCall = mockStreamSearchChat.mock.calls[1][0] as {
            conversationId: string | null;
        };
        expect(secondCall.conversationId).toBe(CONV_ID);
    });

    // ── null conversationId is handled and NOT forwarded on next turn ────────

    it('handles null conversationId from done without crashing, does not send it next turn', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        // First turn — gets null conversationId.
        await act(async () => {
            result.current.send('primera consulta');
        });

        expect(result.current.conversationId).toBeNull();

        // Second turn — null conversationId must NOT be forwarded.
        await act(async () => {
            result.current.send('segunda consulta');
        });

        const secondCall = mockStreamSearchChat.mock.calls[1][0] as {
            conversationId: string | null;
        };
        // The hook passes null when conversationId is null (streamSearchChat
        // itself handles null → omit from body).
        expect(secondCall.conversationId).toBeNull();
    });

    // ── filters accumulate across turns ─────────────────────────────────────

    it('echoes accumulated currentFilters on the second turn', async () => {
        const firstIntent = makeIntent({ minGuests: 2, hasPool: false });
        const firstParams = makeSearchParams({ minGuests: 2, hasPool: false });

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'filters',
                filters: {
                    params: firstParams as unknown as ReturnType<
                        typeof makeFiltersEvent
                    >['filters']['params'],
                    intent: firstIntent
                }
            });
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        // First turn.
        await act(async () => {
            result.current.send('primera consulta');
        });

        expect(result.current.currentFilters).toMatchObject(firstIntent);

        // Second turn — currentFilters should be echoed as currentFilters param.
        await act(async () => {
            result.current.send('segunda consulta');
        });

        const secondCall = mockStreamSearchChat.mock.calls[1][0] as {
            currentFilters: unknown;
        };
        expect(secondCall.currentFilters).toMatchObject(firstIntent);
    });

    // ── multi-turn refinement (T-015) ────────────────────────────────────────

    it('refinement turn updates currentFilters and re-fetches results (multi-turn)', async () => {
        const respWith = (id: string, slug: string) => ({
            ok: true as const,
            data: {
                items: [{ id, name: id, slug }],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });
        mockAccommodationsList.mockReset();
        mockAccommodationsList
            .mockResolvedValueOnce(respWith('acc-A', 'a'))
            .mockResolvedValueOnce(respWith('acc-B', 'b'));

        mockStreamSearchChat
            .mockImplementationOnce(async function (p: {
                onEvent: (e: SearchChatSseEvent) => void;
            }) {
                p.onEvent(makeFiltersEvent({ minGuests: 2, hasPool: false }));
                p.onEvent({ type: 'done', conversationId: CONV_ID });
            })
            .mockImplementationOnce(async (p: { onEvent: (e: SearchChatSseEvent) => void }) => {
                p.onEvent(makeFiltersEvent({ minGuests: 4, maxPrice: 50000 }));
                p.onEvent({ type: 'done', conversationId: CONV_ID });
            });

        const { result } = renderHook(() => useSearchChat(baseParams));

        // Turn 1 — initial search.
        await act(async () => {
            result.current.send('cabaña para 2');
        });
        expect(result.current.currentFilters).toMatchObject({ minGuests: 2, hasPool: false });
        expect((result.current.results[0] as { id: string }).id).toBe('acc-A');

        // Turn 2 — refinement updates BOTH the accumulated filters and the results.
        await act(async () => {
            result.current.send('para 4, más barata');
        });
        expect(result.current.currentFilters).toMatchObject({ minGuests: 4, maxPrice: 50000 });
        expect(result.current.results).toHaveLength(1);
        expect((result.current.results[0] as { id: string }).id).toBe('acc-B');
        expect(mockAccommodationsList).toHaveBeenCalledTimes(2);
    });

    // ── error event ──────────────────────────────────────────────────────────

    it('error event sets error state and stops streaming without throwing', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'token', delta: 'Partial' });
            p.onEvent({ type: 'error', code: 'MODERATION_BLOCKED', message: 'Content policy' });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('consulta problemática');
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.currentReply).toBe('');
        expect(result.current.error).toBe('Content policy');
        // No assistant message appended on error.
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.role).toBe('user');
    });

    // ── stream_error ─────────────────────────────────────────────────────────

    it('stream_error sets error state and stops streaming without throwing', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'token', delta: 'Partial' });
            p.onEvent({
                type: 'stream_error',
                error: new Error('Network failure')
            });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('consulta con error de red');
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.currentReply).toBe('');
        expect(result.current.error).toBe('Network failure');
        expect(result.current.messages).toHaveLength(1);
    });

    // ── reset ────────────────────────────────────────────────────────────────

    it('reset clears all state back to initial', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'token', delta: 'OK' });
            p.onEvent({ type: 'done', conversationId: CONV_ID });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('some query');
        });

        expect(result.current.messages).toHaveLength(2);
        expect(result.current.conversationId).toBe(CONV_ID);
        expect(result.current.hasSearched).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.messages).toEqual([]);
        expect(result.current.currentFilters).toBeNull();
        expect(result.current.results).toEqual([]);
        expect(result.current.resultsLoading).toBe(false);
        expect(result.current.currentReply).toBe('');
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.conversationId).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.hasSearched).toBe(false);
    });

    // ── results stored from accommodations GET ───────────────────────────────

    it('stores accommodation results from the GET triggered by the filters event', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña con pileta');
        });

        expect(result.current.results).toHaveLength(1);
        expect((result.current.results[0] as { id: string }).id).toBe('acc-1');
    });

    // ── resultsLoading flag ──────────────────────────────────────────────────

    it('sets resultsLoading while accommodations fetch is in flight', async () => {
        let resolveList!: (v: ReturnType<typeof makeAccommodationsResponse>) => void;
        const listPromise = new Promise<ReturnType<typeof makeAccommodationsResponse>>((res) => {
            resolveList = res;
        });
        mockAccommodationsList.mockReturnValueOnce(listPromise);

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent());
            // Do NOT emit done yet — let the list fetch be in-flight.
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        act(() => {
            result.current.send('cabaña con pileta');
        });

        // resultsLoading should be true while fetch is pending.
        expect(result.current.resultsLoading).toBe(true);

        // Resolve the fetch.
        await act(async () => {
            resolveList(makeAccommodationsResponse());
        });

        expect(result.current.resultsLoading).toBe(false);
    });

    // ── removeFilter re-runs accommodations search ───────────────────────────

    it('removeFilter drops the key from filters and re-runs accommodations search', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent({ minGuests: 4, hasPool: true, hasWifi: true }));
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña con pileta y wifi para 4');
        });

        expect(result.current.currentFilters?.hasPool).toBe(true);
        expect(result.current.currentFilters?.hasWifi).toBe(true);

        // Remove hasPool filter — should re-run search.
        const callsBeforeRemove = mockAccommodationsList.mock.calls.length;

        await act(async () => {
            result.current.removeFilter('hasPool');
        });

        // A new accommodations call was triggered.
        expect(mockAccommodationsList.mock.calls.length).toBeGreaterThan(callsBeforeRemove);
        // hasPool should no longer be in currentFilters.
        expect(result.current.currentFilters?.hasPool).toBeUndefined();
        // hasWifi should still be present.
        expect(result.current.currentFilters?.hasWifi).toBe(true);
    });

    // ── removeFilter('destinationId') clears nearby expansion (HOS-111 T-014) ──

    it("removeFilter('destinationId') clears BOTH destinationIds and nearbyDestinations after a nearby expansion", async () => {
        const anchorId = '44444444-4444-4444-8444-444444444444';
        const neighborId = '55555555-5555-4555-8555-555555555555';

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'filters',
                filters: {
                    // A nearby expansion resolves the multi-destination filter.
                    params: {
                        destinationId: anchorId,
                        destinationIds: [anchorId, neighborId]
                    } as unknown as Extract<
                        SearchChatSseEvent,
                        { type: 'filters' }
                    >['filters']['params'],
                    intent: { destinationId: anchorId, expandToNearby: true },
                    nearbyDestinations: [
                        { id: neighborId, name: 'Concepción del Uruguay', slug: 'concepcion' }
                    ]
                }
            } as SearchChatSseEvent);
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña en Colón, y también en destinos cercanos');
        });

        expect(result.current.nearbyDestinations).toHaveLength(1);
        expect(result.current.lastSearchParams?.destinationIds).toEqual([anchorId, neighborId]);

        await act(async () => {
            result.current.removeFilter('destinationId');
        });

        // BOTH the multi-destination filter AND the indicator are cleared.
        const params = result.current.lastSearchParams as Record<string, unknown> | null;
        expect(params?.destinationId).toBeUndefined();
        expect(params?.destinationIds).toBeUndefined();
        expect(result.current.nearbyDestinations).toEqual([]);
    });

    it('removing an UNRELATED chip after a nearby expansion leaves nearbyDestinations intact', async () => {
        const anchorId = '44444444-4444-4444-8444-444444444444';
        const neighborId = '55555555-5555-4555-8555-555555555555';

        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'filters',
                filters: {
                    params: {
                        destinationId: anchorId,
                        destinationIds: [anchorId, neighborId],
                        hasPool: true
                    } as unknown as Extract<
                        SearchChatSseEvent,
                        { type: 'filters' }
                    >['filters']['params'],
                    intent: { destinationId: anchorId, hasPool: true, expandToNearby: true },
                    nearbyDestinations: [
                        { id: neighborId, name: 'Concepción del Uruguay', slug: 'concepcion' }
                    ]
                }
            } as SearchChatSseEvent);
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña con pileta en Colón y cerca');
        });
        expect(result.current.nearbyDestinations).toHaveLength(1);

        // Remove an unrelated chip (hasPool) — the nearby expansion is still
        // active, so the indicator (and the multi-destination filter) must stay.
        await act(async () => {
            result.current.removeFilter('hasPool');
        });

        const params = result.current.lastSearchParams as Record<string, unknown> | null;
        expect(result.current.nearbyDestinations).toHaveLength(1);
        expect(params?.destinationIds).toEqual([anchorId, neighborId]);
        expect(params?.hasPool).toBeUndefined();
    });

    // ── confidence forwarded from the filters event (SPEC-265 A1) ─────────────

    it('exposes the confidence carried by the filters event', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'filters',
                filters: {
                    params: makeSearchParams() as unknown as Extract<
                        SearchChatSseEvent,
                        { type: 'filters' }
                    >['filters']['params'],
                    intent: makeIntent(),
                    confidence: 0.3
                }
            } as SearchChatSseEvent);
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('algo ambiguo');
        });

        expect(result.current.confidence).toBe(0.3);
        // makeIntent() carries usable slots, so the turn had entities.
        expect(result.current.lastTurnHadEntities).toBe(true);
    });

    it('flags lastTurnHadEntities as false when the model extracts no slots', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'filters',
                filters: {
                    params: {} as unknown as Extract<
                        SearchChatSseEvent,
                        { type: 'filters' }
                    >['filters']['params'],
                    intent: {},
                    confidence: 0.9
                }
            } as SearchChatSseEvent);
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('mmm');
        });

        // High confidence but no usable slots — the snapshot must report false.
        expect(result.current.confidence).toBe(0.9);
        expect(result.current.lastTurnHadEntities).toBe(false);
    });

    it('keeps lastTurnHadEntities true after removing all chips (snapshot, not live)', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent(makeFiltersEvent({ minGuests: 4 }));
            p.onEvent({ type: 'done', conversationId: null });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('cabaña para 4');
        });
        expect(result.current.lastTurnHadEntities).toBe(true);

        // Remove every filter — the snapshot must NOT flip to false.
        await act(async () => {
            result.current.removeFilter('minGuests');
            result.current.removeFilter('hasPool');
        });

        expect(result.current.lastTurnHadEntities).toBe(true);
    });

    // ── stream_error stores the HTTP status (SPEC-265 C3) ─────────────────────

    it('stores the HTTP status and message from a stream_error event', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            p.onEvent({
                type: 'stream_error',
                status: 429,
                error: new Error('Too many requests')
            });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('algo');
        });

        expect(result.current.errorStatus).toBe(429);
        expect(result.current.error).toBe('Too many requests');
        expect(result.current.isStreaming).toBe(false);
    });

    // ── abort preserves the partial reply (SPEC-265 C1) ───────────────────────

    it('abort stops streaming and commits the partial reply to the thread', async () => {
        mockStreamSearchChat.mockImplementation(async function (p: {
            onEvent: (e: SearchChatSseEvent) => void;
        }) {
            // Stream two tokens but never emit `done` — the turn stays open.
            p.onEvent({ type: 'token', delta: 'Buscando ' });
            p.onEvent({ type: 'token', delta: 'opciones' });
        });

        const { result } = renderHook(() => useSearchChat(baseParams));

        await act(async () => {
            result.current.send('algo');
        });

        expect(result.current.isStreaming).toBe(true);
        expect(result.current.currentReply).toBe('Buscando opciones');

        act(() => {
            result.current.abort();
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.currentReply).toBe('');
        // The partial reply is preserved as the assistant turn in the thread.
        const last = result.current.messages[result.current.messages.length - 1];
        expect(last).toEqual({ role: 'assistant', content: 'Buscando opciones' });
    });
});
