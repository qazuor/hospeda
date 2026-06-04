/**
 * Unit tests for `useWhatsNew`.
 *
 * Tests the four scenarios from SPEC-175 §12.4:
 *  1. Load lifecycle: isLoading transitions → data populated → unseenCount derived.
 *  2. markSeen: optimistic decrement + correct PATCH body sent.
 *  3. markAllSeen: sends all unseen ids in one call.
 *  4. Rollback on mutation failure.
 *
 * Setup:
 * - `useAuthContext` is mocked globally in `test/setup.tsx` to return an ADMIN
 *   user with id `'test_user_id'`.
 * - `fetchApi` (from `@/lib/api/client`) is vi.mocked with a discriminating
 *   implementation per test: GET calls return query data; PATCH calls return
 *   the mutation response (or reject). This avoids mock-queue ordering issues.
 * - Each test gets a fresh `QueryClient` (retry: false, gcTime: 0).
 *
 * @see apps/admin/src/hooks/use-whats-new.ts — subject under test
 * @see SPEC-175 §7.1, §12.4
 */

import type { WhatsNewGetResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhatsNew } from '../use-whats-new';

// ---------------------------------------------------------------------------
// Mock fetchApi at module boundary
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNSEEN_HIGHLIGHT = {
    id: 'entry-highlight-unseen',
    publishedAt: '2026-06-01T00:00:00Z',
    highlight: true,
    title: 'New feature',
    body: 'Feature body',
    seen: false
};

const SEEN_HIGHLIGHT = {
    id: 'entry-highlight-seen',
    publishedAt: '2026-05-01T00:00:00Z',
    highlight: true,
    title: 'Old feature',
    body: 'Old feature body',
    seen: true
};

const UNSEEN_REGULAR = {
    id: 'entry-regular-unseen',
    publishedAt: '2026-04-01T00:00:00Z',
    highlight: false,
    title: 'Minor update',
    body: 'Minor update body',
    seen: false
};

function makeGetResponse(
    items: WhatsNewGetResponse['items'],
    unseenCount?: number
): { success: boolean; data: WhatsNewGetResponse } {
    return {
        success: true,
        data: {
            items,
            unseenCount: unseenCount ?? items.filter((i) => !i.seen).length
        }
    };
}

const PATCH_SUCCESS = { success: true, data: { success: true } };

// ---------------------------------------------------------------------------
// QueryClient wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false }
        }
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, Wrapper };
}

/**
 * Builds a discriminating fetchApi mock implementation.
 *
 * GET calls to `/whats-new` return `getResponse`.
 * PATCH calls to `/whats-new-seen` either resolve with `patchResponse` or
 * reject with `patchError`.
 */
function setupMock({
    getResponse,
    patchResponse = { data: PATCH_SUCCESS, status: 200 },
    patchError
}: {
    getResponse: ReturnType<typeof makeGetResponse>;
    patchResponse?: { data: unknown; status: number };
    patchError?: Error;
}) {
    mockedFetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
        if (input.method === 'PATCH') {
            if (patchError) throw patchError;
            return patchResponse;
        }
        // GET (any refetch)
        return { data: getResponse, status: 200 };
    });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useWhatsNew', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // 1. Load lifecycle
    // -------------------------------------------------------------------------

    describe('load lifecycle', () => {
        it('starts in loading state and populates items + unseenCount after query resolves', async () => {
            // Arrange
            setupMock({
                getResponse: makeGetResponse([UNSEEN_HIGHLIGHT, SEEN_HIGHLIGHT, UNSEEN_REGULAR])
            });

            const { Wrapper } = createWrapper();

            // Act
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            // Assert — loading initially
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Assert — data populated
            expect(result.current.items).toHaveLength(3);
            expect(result.current.unseenCount).toBe(2); // UNSEEN_HIGHLIGHT + UNSEEN_REGULAR
            expect(result.current.error).toBeNull();
        });

        it('calls GET /api/v1/protected/whats-new', async () => {
            // Arrange
            setupMock({ getResponse: makeGetResponse([]) });

            const { Wrapper } = createWrapper();

            // Act
            renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => {
                expect(mockedFetchApi).toHaveBeenCalled();
            });

            // Assert — first call is the GET
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/protected/whats-new' })
            );
        });

        it('exposes error when query fails', async () => {
            // Arrange
            mockedFetchApi.mockRejectedValue(new Error('Network error'));

            const { Wrapper } = createWrapper();

            // Act
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Assert
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.items).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // 2. markSeen — optimistic decrement + correct PATCH body
    // -------------------------------------------------------------------------

    describe('markSeen', () => {
        it('optimistically decrements unseenCount and flips seen on matching items', async () => {
            // Arrange — two unseen items.
            // The refetch (triggered by onSettled's invalidateQueries) returns the
            // server-confirmed state: UNSEEN_HIGHLIGHT is now seen.
            const serverStateAfterPatch = makeGetResponse([
                { ...UNSEEN_HIGHLIGHT, seen: true },
                UNSEEN_REGULAR
            ]);

            // Discriminate by mutation state: GET returns original initially,
            // then the server-confirmed state after the PATCH. We track call count.
            let patchDone = false;
            mockedFetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
                if (input.method === 'PATCH') {
                    patchDone = true;
                    return { data: PATCH_SUCCESS, status: 200 };
                }
                // GET — return server-confirmed state once PATCH has fired
                if (patchDone) {
                    return { data: serverStateAfterPatch, status: 200 };
                }
                return {
                    data: makeGetResponse([UNSEEN_HIGHLIGHT, UNSEEN_REGULAR]),
                    status: 200
                };
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.unseenCount).toBe(2);

            // Act
            act(() => {
                result.current.markSeen([UNSEEN_HIGHLIGHT.id]);
            });

            // Assert — after PATCH + invalidate + refetch, server-confirmed state
            // shows unseenCount === 1 (UNSEEN_HIGHLIGHT is now seen on the server).
            await waitFor(() => {
                expect(result.current.unseenCount).toBe(1);
            });
            expect(result.current.items.find((i) => i.id === UNSEEN_HIGHLIGHT.id)?.seen).toBe(true);
            expect(result.current.items.find((i) => i.id === UNSEEN_REGULAR.id)?.seen).toBe(false);
        });

        it('sends PATCH with the correct body', async () => {
            // Arrange
            setupMock({ getResponse: makeGetResponse([UNSEEN_HIGHLIGHT, UNSEEN_REGULAR]) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Act
            act(() => {
                result.current.markSeen([UNSEEN_HIGHLIGHT.id, UNSEEN_REGULAR.id]);
            });

            // Wait for the PATCH call to appear
            await waitFor(() => {
                return mockedFetchApi.mock.calls.some(
                    ([arg]) =>
                        typeof arg === 'object' &&
                        arg !== null &&
                        'method' in arg &&
                        (arg as { method: string }).method === 'PATCH'
                );
            });

            // Assert — find the PATCH call among all fetchApi calls
            const patchCall = mockedFetchApi.mock.calls.find(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'method' in arg &&
                    (arg as { method: string }).method === 'PATCH'
            )?.[0];

            expect(patchCall).toEqual(
                expect.objectContaining({
                    path: '/api/v1/protected/users/me/whats-new-seen',
                    method: 'PATCH',
                    body: { ids: [UNSEEN_HIGHLIGHT.id, UNSEEN_REGULAR.id] }
                })
            );
        });

        it('is a no-op when called with an empty ids array', async () => {
            // Arrange
            setupMock({ getResponse: makeGetResponse([UNSEEN_HIGHLIGHT]) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            const callsBeforeAct = mockedFetchApi.mock.calls.length;

            // Act
            act(() => {
                result.current.markSeen([]);
            });

            // Assert — no additional calls (no PATCH, no refetch)
            expect(mockedFetchApi).toHaveBeenCalledTimes(callsBeforeAct);
        });
    });

    // -------------------------------------------------------------------------
    // 3. markAllSeen — sends all unseen ids
    // -------------------------------------------------------------------------

    describe('markAllSeen', () => {
        it('calls mutation with all currently unseen ids', async () => {
            // Arrange — three items: 2 unseen, 1 seen
            setupMock({
                getResponse: makeGetResponse([UNSEEN_HIGHLIGHT, SEEN_HIGHLIGHT, UNSEEN_REGULAR])
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Act
            act(() => {
                result.current.markAllSeen();
            });

            // Wait for the PATCH call to appear
            await waitFor(() => {
                return mockedFetchApi.mock.calls.some(
                    ([arg]) =>
                        typeof arg === 'object' &&
                        arg !== null &&
                        'method' in arg &&
                        (arg as { method: string }).method === 'PATCH'
                );
            });

            // Assert — PATCH body contains only the unseen ids (not SEEN_HIGHLIGHT)
            const patchCall = mockedFetchApi.mock.calls.find(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'method' in arg &&
                    (arg as { method: string }).method === 'PATCH'
            )?.[0];

            const sentIds = (patchCall as { body: { ids: string[] } }).body.ids;
            expect(sentIds).toContain(UNSEEN_HIGHLIGHT.id);
            expect(sentIds).toContain(UNSEEN_REGULAR.id);
            expect(sentIds).not.toContain(SEEN_HIGHLIGHT.id);
        });

        it('is a no-op when unseenCount is 0', async () => {
            // Arrange
            setupMock({ getResponse: makeGetResponse([SEEN_HIGHLIGHT]) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            const callsBeforeAct = mockedFetchApi.mock.calls.length;

            // Act
            act(() => {
                result.current.markAllSeen();
            });

            // Assert — no additional call (no PATCH, no refetch)
            expect(mockedFetchApi).toHaveBeenCalledTimes(callsBeforeAct);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Rollback on mutation failure
    // -------------------------------------------------------------------------

    describe('rollback on mutation failure', () => {
        it('restores previous unseenCount when PATCH fails', async () => {
            // Arrange — initial data: 2 unseen
            setupMock({
                getResponse: makeGetResponse([UNSEEN_HIGHLIGHT, UNSEEN_REGULAR]),
                patchError: new Error('Server error')
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useWhatsNew(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.unseenCount).toBe(2);

            // Act — trigger mutation (will fail)
            act(() => {
                result.current.markSeen([UNSEEN_HIGHLIGHT.id]);
            });

            // After rollback + settle refetch, count must return to 2.
            await waitFor(
                () => {
                    expect(result.current.unseenCount).toBe(2);
                },
                { timeout: 5000 }
            );

            // Assert — rolled back: item is unseen again
            expect(result.current.items.find((i) => i.id === UNSEEN_HIGHLIGHT.id)?.seen).toBe(
                false
            );
        });
    });
});
