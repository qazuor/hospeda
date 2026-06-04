/**
 * Unit tests for `useAdminTourState` (SPEC-174 T-009).
 *
 * Tests the four lifecycle scenarios from SPEC-174 §7.5 + §14:
 *  1. Load lifecycle: isLoading transitions → data populated.
 *  2. hasSeen semantics: absent → false; lower stored → false; equal/higher → true.
 *  3. markSeen: optimistic update + correct PATCH body sent.
 *  4. Rollback on mutation failure.
 *
 * Setup:
 * - `useAuthContext` is mocked globally in `test/setup.tsx` to return an ADMIN
 *   user with id `'test_user_id'`.
 * - `fetchApi` (from `@/lib/api/client`) is vi.mocked with a discriminating
 *   implementation per test: GET calls return query data; PATCH calls return
 *   the mutation response (or reject).
 * - Each test gets a fresh `QueryClient` (retry: false, gcTime: 0).
 *
 * @see apps/admin/src/hooks/use-admin-tour-state.ts — subject under test
 * @see SPEC-174 §7.5, §14
 */

import type { UserProtected } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminTourState } from '../use-admin-tour-state';

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

const USER_ID = 'test_user_id';

/** Builds a minimal UserProtected fixture with optional adminTours overrides. */
function makeUserProtected(adminTours: Record<string, number> = {}): UserProtected {
    return {
        id: USER_ID,
        name: 'Test User',
        email: 'test@example.com',
        slug: 'test-user',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        settings: {
            onboarding: {
                adminTours: Object.keys(adminTours).length > 0 ? adminTours : undefined
            }
        }
    } as unknown as UserProtected;
}

function makeGetResponse(user: UserProtected) {
    return { success: true, data: { success: true, data: user } };
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
 * GET calls to `/users/test_user_id` return `getResponse`.
 * PATCH calls to `/tour-progress` either resolve with `patchResponse` or
 * reject with `patchError`.
 */
function setupMock({
    user,
    patchResponse = { data: PATCH_SUCCESS, status: 200 },
    patchError
}: {
    user: UserProtected;
    patchResponse?: { data: unknown; status: number };
    patchError?: Error;
}) {
    mockedFetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
        if (input.method === 'PATCH') {
            if (patchError) throw patchError;
            return patchResponse;
        }
        // GET (any refetch)
        return { data: makeGetResponse(user).data, status: 200 };
    });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useAdminTourState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // 1. Load lifecycle
    // -------------------------------------------------------------------------

    describe('load lifecycle', () => {
        it('starts in loading state and populates data after query resolves', async () => {
            // Arrange
            const user = makeUserProtected({ 'host.welcome': 1 });
            setupMock({ user });

            const { Wrapper } = createWrapper();

            // Act
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            // Assert — loading initially
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Assert — data populated
            expect(result.current.error).toBeNull();
        });

        it(`calls GET /api/v1/protected/users/${USER_ID}`, async () => {
            // Arrange
            setupMock({ user: makeUserProtected() });

            const { Wrapper } = createWrapper();

            // Act
            renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => {
                expect(mockedFetchApi).toHaveBeenCalled();
            });

            // Assert — first call is the GET
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/protected/users/${USER_ID}`
                })
            );
        });

        it('exposes error when query fails', async () => {
            // Arrange
            mockedFetchApi.mockRejectedValue(new Error('Network error'));

            const { Wrapper } = createWrapper();

            // Act
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // Assert
            expect(result.current.error).toBeInstanceOf(Error);
        });
    });

    // -------------------------------------------------------------------------
    // 2. hasSeen semantics
    // -------------------------------------------------------------------------

    describe('hasSeen', () => {
        it('returns false when the tour has never been seen (absent from map)', async () => {
            // Arrange — no adminTours at all
            setupMock({ user: makeUserProtected() });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Assert
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(false);
        });

        it('returns false when stored version is lower than config version', async () => {
            // Arrange — seen at v1, config now at v2
            setupMock({ user: makeUserProtected({ 'host.welcome': 1 }) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Assert
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 2 })).toBe(false);
        });

        it('returns true when stored version equals config version', async () => {
            // Arrange — seen at v1, config at v1
            setupMock({ user: makeUserProtected({ 'host.welcome': 1 }) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Assert
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(true);
        });

        it('returns true when stored version is higher than config version', async () => {
            // Arrange — seen at v3, config at v2 (user saw a newer version somehow)
            setupMock({ user: makeUserProtected({ 'host.welcome': 3 }) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Assert
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 2 })).toBe(true);
        });

        it('returns false for a different tourId even when another tour has been seen', async () => {
            // Arrange — only 'host.welcome' seen
            setupMock({ user: makeUserProtected({ 'host.welcome': 1 }) });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Assert — 'editor.analisis' not seen
            expect(result.current.hasSeen({ tourId: 'editor.analisis', version: 1 })).toBe(false);
        });

        it('returns true for multiple seen tours independently', async () => {
            // Arrange — both tours seen
            setupMock({
                user: makeUserProtected({
                    'host.welcome': 2,
                    'host.misAlojamientos': 1
                })
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 2 })).toBe(true);
            expect(result.current.hasSeen({ tourId: 'host.misAlojamientos', version: 1 })).toBe(
                true
            );
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 3 })).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 3. markSeen — optimistic update + correct PATCH body
    // -------------------------------------------------------------------------

    describe('markSeen', () => {
        it('optimistically sets adminTours[tourId] = version in cache', async () => {
            // Arrange — tour not yet seen
            const serverStateAfterPatch = makeUserProtected({ 'host.welcome': 1 });

            let patchDone = false;
            mockedFetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
                if (input.method === 'PATCH') {
                    patchDone = true;
                    return { data: PATCH_SUCCESS, status: 200 };
                }
                // Return server-confirmed state once PATCH has fired
                if (patchDone) {
                    return {
                        data: makeGetResponse(serverStateAfterPatch).data,
                        status: 200
                    };
                }
                return {
                    data: makeGetResponse(makeUserProtected()).data,
                    status: 200
                };
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(false);

            // Act
            act(() => {
                result.current.markSeen({ tourId: 'host.welcome', version: 1 });
            });

            // After PATCH + invalidate + refetch, tour should be seen
            await waitFor(() => {
                expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(true);
            });
        });

        it('sends PATCH with the correct body', async () => {
            // Arrange
            setupMock({ user: makeUserProtected() });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Act
            act(() => {
                result.current.markSeen({ tourId: 'editor.analisis', version: 2 });
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
                    path: '/api/v1/protected/users/me/tour-progress',
                    method: 'PATCH',
                    body: { tourId: 'editor.analisis', version: 2 }
                })
            );
        });

        it('preserves other tourId entries in the optimistic update', async () => {
            // Arrange — 'host.misAlojamientos' already seen at v1, 'host.welcome' unseen.
            // After the PATCH the server confirms host.welcome: 1, preserving misAlojamientos.
            const userBeforePatch = makeUserProtected({ 'host.misAlojamientos': 1 });
            const userAfterPatch = makeUserProtected({
                'host.misAlojamientos': 1,
                'host.welcome': 1
            });

            let patchDone = false;
            mockedFetchApi.mockImplementation(async (input: { path: string; method?: string }) => {
                if (input.method === 'PATCH') {
                    patchDone = true;
                    return { data: PATCH_SUCCESS, status: 200 };
                }
                if (patchDone) {
                    return {
                        data: makeGetResponse(userAfterPatch).data,
                        status: 200
                    };
                }
                return {
                    data: makeGetResponse(userBeforePatch).data,
                    status: 200
                };
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.hasSeen({ tourId: 'host.misAlojamientos', version: 1 })).toBe(
                true
            );

            // Act — mark a different tour seen
            act(() => {
                result.current.markSeen({ tourId: 'host.welcome', version: 1 });
            });

            // Assert — after PATCH + invalidate + refetch, both tours are seen
            await waitFor(() => {
                expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(true);
            });
            expect(result.current.hasSeen({ tourId: 'host.misAlojamientos', version: 1 })).toBe(
                true
            );
        });
    });

    // -------------------------------------------------------------------------
    // 4. Rollback on mutation failure
    // -------------------------------------------------------------------------

    describe('rollback on mutation failure', () => {
        it('restores the previous seen state when PATCH fails', async () => {
            // Arrange — initial data: tour not seen
            setupMock({
                user: makeUserProtected(),
                patchError: new Error('Server error')
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(false);

            // Act — trigger mutation (will fail)
            act(() => {
                result.current.markSeen({ tourId: 'host.welcome', version: 1 });
            });

            // After rollback + settle refetch, tour must still be unseen.
            await waitFor(
                () => {
                    expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(
                        false
                    );
                },
                { timeout: 5000 }
            );
        });

        it('preserves other tour entries when rolling back', async () => {
            // Arrange — 'host.misAlojamientos' already seen at v1, 'host.welcome' unseen
            const userWithExisting = makeUserProtected({ 'host.misAlojamientos': 1 });
            setupMock({
                user: userWithExisting,
                patchError: new Error('Server error')
            });

            const { Wrapper } = createWrapper();
            const { result } = renderHook(() => useAdminTourState(), { wrapper: Wrapper });

            await waitFor(() => expect(result.current.isLoading).toBe(false));

            // Act — try to mark host.welcome seen (will fail)
            act(() => {
                result.current.markSeen({ tourId: 'host.welcome', version: 1 });
            });

            // After rollback: host.welcome still unseen, host.misAlojamientos still seen
            await waitFor(
                () => {
                    expect(result.current.hasSeen({ tourId: 'host.welcome', version: 1 })).toBe(
                        false
                    );
                },
                { timeout: 5000 }
            );
            expect(result.current.hasSeen({ tourId: 'host.misAlojamientos', version: 1 })).toBe(
                true
            );
        });
    });
});
