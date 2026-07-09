// @vitest-environment jsdom
/**
 * Tests for `useUnreadCount` (HOS-109 T-006).
 *
 * The unread-count badge polls GET /api/v1/admin/conversations/unread-count
 * every 30s. An admin actor lacking the conversations permission would
 * otherwise re-hit it forever, flooding the API logs + rate limiter with 403s.
 * These tests guard that a 403 stops the poll permanently and that no client
 * error (403/429/...) is retried, while genuine transient failures still retry
 * and successful polls keep their cadence.
 *
 * The polling + retry policies are extracted as pure functions so they can be
 * asserted deterministically without fake timers. Mirrors the `renderHook` +
 * mocked-`fetchApi` pattern from
 * `apps/admin/src/features/ai-settings/__tests__/hooks.sync-models-preflight.test.ts`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import {
    isForbiddenApiError,
    UNREAD_COUNT_POLL_INTERVAL_MS,
    unreadCountRefetchInterval,
    unreadCountShouldRetry,
    useUnreadCount
} from '../useUnreadCount';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

/** QueryClientProvider wrapper. Retries are left to the hook's own policy. */
function createWrapper() {
    const queryClient = new QueryClient();
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('isForbiddenApiError', () => {
    it('returns true for a 403 ApiError', () => {
        expect(isForbiddenApiError(new ApiError('nope', { status: 403 }))).toBe(true);
    });

    it('returns false for a non-403 ApiError', () => {
        expect(isForbiddenApiError(new ApiError('boom', { status: 500 }))).toBe(false);
        expect(isForbiddenApiError(new ApiError('missing', { status: 404 }))).toBe(false);
    });

    it('returns false for a plain Error / non-API value', () => {
        expect(isForbiddenApiError(new Error('network'))).toBe(false);
        expect(isForbiddenApiError(null)).toBe(false);
        expect(isForbiddenApiError('403')).toBe(false);
    });
});

describe('unreadCountRefetchInterval', () => {
    it('stops polling (false) after a 403', () => {
        expect(unreadCountRefetchInterval(new ApiError('nope', { status: 403 }))).toBe(false);
    });

    it('keeps polling after a non-403 error (transient) or no error', () => {
        expect(unreadCountRefetchInterval(new ApiError('boom', { status: 500 }))).toBe(
            UNREAD_COUNT_POLL_INTERVAL_MS
        );
        expect(unreadCountRefetchInterval(null)).toBe(UNREAD_COUNT_POLL_INTERVAL_MS);
        expect(unreadCountRefetchInterval(undefined)).toBe(UNREAD_COUNT_POLL_INTERVAL_MS);
    });
});

describe('unreadCountShouldRetry', () => {
    it('never retries any 4xx client error (403 permission, 429 rate-limit, 404)', () => {
        expect(unreadCountShouldRetry(0, new ApiError('forbidden', { status: 403 }))).toBe(false);
        expect(unreadCountShouldRetry(0, new ApiError('too many', { status: 429 }))).toBe(false);
        expect(unreadCountShouldRetry(0, new ApiError('missing', { status: 404 }))).toBe(false);
    });

    it('retries transient failures (network / 5xx) up to 3 times', () => {
        expect(unreadCountShouldRetry(0, new Error('network'))).toBe(true);
        expect(unreadCountShouldRetry(2, new ApiError('boom', { status: 500 }))).toBe(true);
        expect(unreadCountShouldRetry(3, new ApiError('boom', { status: 500 }))).toBe(false);
    });
});

describe('useUnreadCount (HOS-109 T-006)', () => {
    it('returns the unread count on success', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { count: 7 } },
            status: 200
        });

        const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual({ count: 7 });
    });

    it('does NOT retry a 403 — the endpoint is hit exactly once', async () => {
        mockedFetchApi.mockRejectedValue(new ApiError('Forbidden', { status: 403 }));

        const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isError).toBe(true));

        // Terminal: no retry storm on a permission denial.
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
    });
});
