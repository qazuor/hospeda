/**
 * @file use-reputation-status.test.ts
 * @description Unit tests for the useReputationStatus polling hook (SPEC-250 Phase 7).
 *
 * Covers:
 *  - Polling starts immediately when enabled.
 *  - Polling stops when allSettled becomes true.
 *  - Interval is cleaned up on unmount.
 *  - Transient fetch error (network): silent retry — polling continues.
 *  - 4xx/5xx from status endpoint: sets error, stops polling.
 *
 * Strategy: vi.useFakeTimers with real-timer waitFor disabled.
 * We use `act(() => { vi.advanceTimersByTime(N) })` to tick the interval, then
 * `await act(async () => {})` to flush the resulting microtask queue (resolved
 * fetch promises). We avoid `waitFor` in tests that advance fake timers because
 * testing-library's waitFor also uses setTimeout internally, which deadlocks
 * when all timers are fake.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReputationStatus } from '../../src/hooks/use-reputation-status';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACC_ID = 'acc-uuid-spec250';
const POLL_MS = 10_000;
const STATUS_URL = `/api/v1/protected/accommodations/${ACC_ID}/external-reputation/status`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStatusBody(allSettled: boolean) {
    const runStatus = allSettled ? ('idle' as const) : ('pending' as const);
    return {
        success: true,
        data: {
            platforms: {
                GOOGLE: {
                    runStatus,
                    fetchStatus: 'ok' as const,
                    rating: 8.5,
                    reviewsCount: 42,
                    aggregateFetchedAt: '2026-06-20T10:00:00Z'
                }
            },
            allSettled
        }
    };
}

function makeOkResponse(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => body
    } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
    return {
        ok: false,
        status,
        json: async () => ({ error: { message: 'Server error' } })
    } as unknown as Response;
}

/**
 * Flushes all pending microtasks by yielding multiple times.
 * Each `mockResolvedValue(...)` call creates at least 2 async hops
 * (the promise itself + json()). We flush 10 times to be safe.
 */
async function flushPromises(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

/**
 * Ticks the fake clock by `ms` ms (fires interval callbacks) then flushes
 * all pending microtasks so resolved fetch promises and setState calls complete.
 */
async function tickAndFlush(ms: number): Promise<void> {
    await act(async () => {
        vi.advanceTimersByTime(ms);
        await flushPromises();
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useReputationStatus', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    // ── 1. Polling starts when enabled ─────────────────────────────────────

    describe('polling starts when enabled', () => {
        it('fetches immediately on mount when enabled=true', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            // loading starts true
            expect(result.current.loading).toBe(true);

            // Flush the initial fetch promise (no timer tick needed — fires synchronously)
            await act(async () => {
                await flushPromises();
            });

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
            const [calledUrl] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(STATUS_URL);
        });

        it('returns platform data and clears loading after first successful fetch', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.loading).toBe(false);
            expect(result.current.platforms.GOOGLE).toBeDefined();
            expect(result.current.platforms.GOOGLE?.rating).toBe(8.5);
            expect(result.current.allSettled).toBe(false);
            expect(result.current.error).toBeNull();
        });

        it('polls again after POLL_INTERVAL_MS when not settled', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial fetch.
            await act(async () => {
                await flushPromises();
            });

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);

            // Advance one poll interval.
            await tickAndFlush(POLL_MS);

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
        });

        it('does NOT fetch when enabled=false', async () => {
            renderHook(() => useReputationStatus(ACC_ID, false));

            await tickAndFlush(POLL_MS * 2);

            expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
        });
    });

    // ── 2. Polling stops when allSettled becomes true ───────────────────────

    describe('polling stops when allSettled', () => {
        it('stops polling after endpoint reports allSettled=true', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeOkResponse(makeStatusBody(false)))
                .mockResolvedValueOnce(makeOkResponse(makeStatusBody(true)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial fetch (pending state).
            await act(async () => {
                await flushPromises();
            });

            expect(result.current.allSettled).toBe(false);

            // Advance one interval — second fetch returns allSettled=true.
            await tickAndFlush(POLL_MS);

            expect(result.current.allSettled).toBe(true);

            const callCountAfterSettled = vi.mocked(global.fetch).mock.calls.length;
            expect(callCountAfterSettled).toBe(2);

            // Advance more intervals — no further fetches expected.
            await tickAndFlush(POLL_MS * 3);

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(callCountAfterSettled);
        });

        it('sets allSettled=true and loading=false after settled response', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(makeStatusBody(true)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.allSettled).toBe(true);
            expect(result.current.loading).toBe(false);
        });
    });

    // ── 3. Interval cleanup on unmount ──────────────────────────────────────

    describe('cleanup on unmount', () => {
        it('clears interval when component unmounts during polling', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            const { unmount } = renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial fetch.
            await act(async () => {
                await flushPromises();
            });

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);

            // Unmount clears the interval.
            unmount();

            // Advance time — no additional fetches after unmount.
            await tickAndFlush(POLL_MS * 3);

            // Still 1 call — no polling after unmount.
            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
        });
    });

    // ── 4. Silent retry on transient network error ──────────────────────────

    describe('transient fetch error: silent retry', () => {
        it('keeps error null and starts interval after initial network error', async () => {
            vi.mocked(global.fetch)
                .mockRejectedValueOnce(new TypeError('Network error'))
                .mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial (rejected) fetch.
            await act(async () => {
                await flushPromises();
            });

            // error must stay null — network errors are silent.
            expect(result.current.error).toBeNull();
            expect(result.current.loading).toBe(false);
        });

        it('continues polling after network error during interval tick', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeOkResponse(makeStatusBody(false)))
                .mockRejectedValueOnce(new TypeError('Network error'))
                .mockResolvedValue(makeOkResponse(makeStatusBody(false)));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial fetch.
            await act(async () => {
                await flushPromises();
            });

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);

            // First interval tick — network error.
            await tickAndFlush(POLL_MS);

            // error still null after transient failure.
            expect(result.current.error).toBeNull();
            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);

            // Second interval tick — succeeds.
            await tickAndFlush(POLL_MS);

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
        });
    });

    // ── 5. 4xx/5xx: set error and stop polling ──────────────────────────────

    describe('HTTP 4xx/5xx: sets error and stops polling', () => {
        it('sets error and does not start interval on 500 at initial fetch', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeErrorResponse(500));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.error).not.toBeNull();
            expect(result.current.loading).toBe(false);

            const fetchCountAfterError = vi.mocked(global.fetch).mock.calls.length;
            expect(fetchCountAfterError).toBe(1);

            // Advance time — no more fetches expected.
            await tickAndFlush(POLL_MS * 3);

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(fetchCountAfterError);
        });

        it('sets error and stops polling on 403 during interval tick', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeOkResponse(makeStatusBody(false)))
                .mockResolvedValue(makeErrorResponse(403));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            // Flush initial fetch (ok).
            await act(async () => {
                await flushPromises();
            });

            expect(result.current.error).toBeNull();

            // First interval tick — 403.
            await tickAndFlush(POLL_MS);

            expect(result.current.error).not.toBeNull();

            const fetchCountAfterError = vi.mocked(global.fetch).mock.calls.length;

            // No further polls.
            await tickAndFlush(POLL_MS * 3);

            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(fetchCountAfterError);
        });

        it('error value is the sentinel string when status endpoint fails', async () => {
            vi.mocked(global.fetch).mockResolvedValue(makeErrorResponse(404));

            const { result } = renderHook(() => useReputationStatus(ACC_ID, true));

            await act(async () => {
                await flushPromises();
            });

            expect(result.current.error).toBe('status_endpoint_error');
        });
    });
});
