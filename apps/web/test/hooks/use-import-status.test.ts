/**
 * @file use-import-status.test.ts
 * @description Unit tests for the useImportStatus polling hook
 * (HOS-50 / SPEC-277 R3 T-012; rewritten for HOS-134 to assert the hook
 * polls via `accommodationsImportApi.getStatus` — the shared `apiClient` —
 * instead of a direct `fetch()` call. The direct-`fetch()` version resolved
 * its root-relative path against the WEB origin instead of the API host in
 * production, 404ing every poll).
 *
 * Covers:
 *  - Polling starts immediately when enabled and a run handle is present.
 *  - Polling does NOT start when disabled or the run handle is null.
 *  - Polling stops when the run settles.
 *  - Interval is cleaned up on unmount (no further fetches).
 *  - Transient fetch error (network / timeout): silent retry — polling continues.
 *  - 4xx/5xx from status endpoint: sets error, stops polling.
 *  - Regression guard: fetchStatus never calls the global `fetch()`.
 *
 * Strategy mirrors `use-reputation-status.test.ts`: fake timers + explicit
 * microtask flushing (avoids `waitFor`, which deadlocks under fake timers).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStatus } = vi.hoisted(() => ({
    mockGetStatus: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationsImportApi: {
        getStatus: (...args: unknown[]) => mockGetStatus(...args)
    }
}));

import { type ImportRunHandle, useImportStatus } from '../../src/hooks/use-import-status';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_MS = 5_000;

const RUN_HANDLE: ImportRunHandle = {
    runId: 'run-abc123',
    datasetId: 'dataset-xyz789',
    source: 'airbnb',
    startedAt: '2026-07-02T09:20:00.000Z',
    url: 'https://www.airbnb.com/rooms/12345'
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOkResult(settled: boolean, failed = false) {
    if (!settled) {
        return { ok: true, data: { settled: false } };
    }
    if (failed) {
        return { ok: true, data: { settled: true, failureCode: 'timeout' } };
    }
    return {
        ok: true,
        data: {
            settled: true,
            draft: {
                draft: { name: { value: 'Cabaña del Río', source: 'jsonld' } },
                source: 'airbnb',
                methodsUsed: ['jsonld'],
                partial: true
            }
        }
    };
}

/** A hard 4xx/5xx from the status endpoint — polling must stop. */
function makeHttpErrorResult(status: number) {
    return { ok: false, error: { status, message: 'Server error' } };
}

/** A transient network failure, as surfaced by `apiClient` (status 0). */
function makeNetworkErrorResult() {
    return { ok: false, error: { status: 0, message: 'Network error' } };
}

async function flushPromises(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

async function tickAndFlush(ms: number): Promise<void> {
    await act(async () => {
        vi.advanceTimersByTime(ms);
        await flushPromises();
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useImportStatus', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    // ── 0. Regression guard: uses apiClient, never global fetch ────────────

    it('polls via accommodationsImportApi.getStatus, never global fetch (HOS-134 regression guard)', async () => {
        mockGetStatus.mockResolvedValue(makeOkResult(false));

        renderHook(() => useImportStatus(RUN_HANDLE, true));

        await act(async () => {
            await flushPromises();
        });

        expect(mockGetStatus).toHaveBeenCalledTimes(1);
        expect(mockGetStatus).toHaveBeenCalledWith(RUN_HANDLE);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    // ── 1. Polling starts when enabled ─────────────────────────────────────

    describe('polling starts when enabled', () => {
        it('fetches immediately on mount when enabled=true and a run handle is present', async () => {
            mockGetStatus.mockResolvedValue(makeOkResult(false));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            expect(result.current.isPolling).toBe(true);

            await act(async () => {
                await flushPromises();
            });

            expect(mockGetStatus).toHaveBeenCalledTimes(1);
            expect(mockGetStatus).toHaveBeenCalledWith(RUN_HANDLE);
        });

        it('polls again after POLL_INTERVAL_MS when not settled', async () => {
            mockGetStatus.mockResolvedValue(makeOkResult(false));

            renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });
            expect(mockGetStatus).toHaveBeenCalledTimes(1);

            await tickAndFlush(POLL_MS);

            expect(mockGetStatus).toHaveBeenCalledTimes(2);
        });

        it('does NOT fetch when enabled=false', async () => {
            renderHook(() => useImportStatus(RUN_HANDLE, false));

            await tickAndFlush(POLL_MS * 2);

            expect(mockGetStatus).not.toHaveBeenCalled();
        });

        it('does NOT fetch when the run handle is null', async () => {
            renderHook(() => useImportStatus(null, true));

            await tickAndFlush(POLL_MS * 2);

            expect(mockGetStatus).not.toHaveBeenCalled();
        });
    });

    // ── 2. Polling stops when settled ────────────────────────────────────────

    describe('polling stops when settled', () => {
        it('stops polling and returns the draft after the run succeeds', async () => {
            mockGetStatus
                .mockResolvedValueOnce(makeOkResult(false))
                .mockResolvedValueOnce(makeOkResult(true));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });
            expect(result.current.settled).toBe(false);

            await tickAndFlush(POLL_MS);

            expect(result.current.settled).toBe(true);
            expect(result.current.isPolling).toBe(false);
            expect(result.current.draft?.source).toBe('airbnb');
            expect(result.current.failureCode).toBeNull();

            const callCountAfterSettled = mockGetStatus.mock.calls.length;
            await tickAndFlush(POLL_MS * 3);

            expect(mockGetStatus).toHaveBeenCalledTimes(callCountAfterSettled);
        });

        it('stops polling and returns the failureCode when the run fails', async () => {
            mockGetStatus.mockResolvedValue(makeOkResult(true, true));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.settled).toBe(true);
            expect(result.current.failureCode).toBe('timeout');
            expect(result.current.draft).toBeNull();
            expect(result.current.isPolling).toBe(false);
        });

        it('resets settled/draft/failureCode when a new run handle is provided after a previous run settled', async () => {
            // Arrange — first run settles with a failure.
            mockGetStatus.mockResolvedValue(makeOkResult(true, true));

            const { result, rerender } = renderHook(
                ({ handle }: { handle: ImportRunHandle }) => useImportStatus(handle, true),
                { initialProps: { handle: RUN_HANDLE } }
            );

            await act(async () => {
                await flushPromises();
            });
            expect(result.current.settled).toBe(true);
            expect(result.current.failureCode).toBe('timeout');

            // Act — a second, distinct run handle is provided (e.g. the host
            // re-submitted a different URL); the second run has not settled yet.
            mockGetStatus.mockResolvedValue(makeOkResult(false));
            const secondHandle: ImportRunHandle = { ...RUN_HANDLE, runId: 'run-second' };
            rerender({ handle: secondHandle });

            // Assert — immediately after the handle changes (before the fresh
            // fetch resolves), stale settle data from the first run must NOT
            // leak through.
            expect(result.current.settled).toBe(false);
            expect(result.current.failureCode).toBeNull();
            expect(result.current.draft).toBeNull();

            await act(async () => {
                await flushPromises();
            });
            expect(result.current.settled).toBe(false);
        });
    });

    // ── 3. Interval cleanup on unmount ──────────────────────────────────────

    describe('cleanup on unmount', () => {
        it('clears the interval when the component unmounts during polling', async () => {
            mockGetStatus.mockResolvedValue(makeOkResult(false));

            const { unmount } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });
            expect(mockGetStatus).toHaveBeenCalledTimes(1);

            unmount();

            await tickAndFlush(POLL_MS * 3);

            // No fetches (and therefore no state updates) after unmount.
            expect(mockGetStatus).toHaveBeenCalledTimes(1);
        });
    });

    // ── 4. Silent retry on transient network error ──────────────────────────

    describe('transient fetch error: silent retry', () => {
        it('keeps error null after an initial network error', async () => {
            mockGetStatus
                .mockResolvedValueOnce(makeNetworkErrorResult())
                .mockResolvedValue(makeOkResult(false));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.error).toBeNull();
        });

        it('continues polling after a network error during an interval tick', async () => {
            mockGetStatus
                .mockResolvedValueOnce(makeOkResult(false))
                .mockResolvedValueOnce(makeNetworkErrorResult())
                .mockResolvedValue(makeOkResult(false));

            renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });
            expect(mockGetStatus).toHaveBeenCalledTimes(1);

            await tickAndFlush(POLL_MS);
            expect(mockGetStatus).toHaveBeenCalledTimes(2);

            await tickAndFlush(POLL_MS);
            expect(mockGetStatus).toHaveBeenCalledTimes(3);
        });
    });

    // ── 5. 4xx/5xx: set error and stop polling ──────────────────────────────

    describe('HTTP 4xx/5xx: sets error and stops polling', () => {
        it('sets error and does not start the interval on a 500 at the initial fetch', async () => {
            mockGetStatus.mockResolvedValue(makeHttpErrorResult(500));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.error).toBe('status_endpoint_error');
            expect(result.current.isPolling).toBe(false);

            const fetchCountAfterError = mockGetStatus.mock.calls.length;
            await tickAndFlush(POLL_MS * 3);

            expect(mockGetStatus).toHaveBeenCalledTimes(fetchCountAfterError);
        });

        it('sets error and stops polling on a 403 during an interval tick', async () => {
            mockGetStatus
                .mockResolvedValueOnce(makeOkResult(false))
                .mockResolvedValue(makeHttpErrorResult(403));

            const { result } = renderHook(() => useImportStatus(RUN_HANDLE, true));

            await act(async () => {
                await flushPromises();
            });
            expect(result.current.error).toBeNull();

            await tickAndFlush(POLL_MS);

            expect(result.current.error).toBe('status_endpoint_error');

            const fetchCountAfterError = mockGetStatus.mock.calls.length;
            await tickAndFlush(POLL_MS * 3);

            expect(mockGetStatus).toHaveBeenCalledTimes(fetchCountAfterError);
        });
    });
});
