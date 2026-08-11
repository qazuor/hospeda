/**
 * @file use-host-trade-moderation.test.tsx
 * @description The host-trade moderation hooks (HOS-376 T-055).
 *
 * The assertions concentrate on what fails SILENTLY: a query param that is
 * dropped or coerced, a response unwrapped one level short, and a cache that is
 * not invalidated after a verdict. None of those throw — they just show the
 * moderator the wrong queue.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchApi = vi.fn();

vi.mock('@/lib/api/client', () => ({
    fetchApi: (args: unknown) => mockFetchApi(args)
}));

import {
    useHostTradePendingCounts,
    useHostTradeRepliesQueue,
    useHostTradeReviewsQueue,
    useModerateHostTradeReply,
    useModerateHostTradeReview
} from '../use-host-trade-moderation';

/**
 * Builds a provider wrapper with retries disabled.
 *
 * @returns The wrapper component and its query client.
 */
function buildWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper, queryClient };
}

/** The path the last `fetchApi` call requested. */
function lastPath(): string {
    return mockFetchApi.mock.calls.at(-1)?.[0]?.path ?? '';
}

describe('use-host-trade-moderation', () => {
    beforeEach(() => {
        mockFetchApi.mockReset();
    });

    describe('the review queue', () => {
        it('should unwrap the page the API nested twice', async () => {
            mockFetchApi.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        items: [{ id: 'review-1' }],
                        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                    }
                }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useHostTradeReviewsQueue(), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data?.items).toEqual([{ id: 'review-1' }]);
            expect(result.current.data?.pagination.total).toBe(1);
        });

        it('should ask for every moderation state by default', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useHostTradeReviewsQueue(), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            // A queue scoped to APPROVED would have nothing left to moderate.
            expect(lastPath()).not.toContain('moderationState');
        });

        it('should forward the filters it was given', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(
                () => useHostTradeReviewsQueue({ moderationState: 'PENDING', page: 2 }),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).toContain('moderationState=PENDING');
            expect(lastPath()).toContain('page=2');
        });

        it('should send respectedBenefit=false rather than drop it', async () => {
            // The filter that surfaces providers who did NOT honour the benefit
            // is the one whose whole value is the `false` case. Treating it as
            // "unset" would silently show the opposite of what was asked.
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(
                () => useHostTradeReviewsQueue({ respectedBenefit: false }),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).toContain('respectedBenefit=false');
        });

        it('should omit a filter that was not set', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(
                () => useHostTradeReviewsQueue({ hostTradeId: undefined, page: 1 }),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).not.toContain('hostTradeId');
            expect(lastPath()).not.toContain('undefined');
        });
    });

    describe('the reply queue', () => {
        it('should read its own endpoint, never the review one', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useHostTradeRepliesQueue({ page: 1 }), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).toContain('/admin/host-trades/replies');
            expect(lastPath()).not.toContain('/reviews');
        });
    });

    describe('the pending counts', () => {
        it('should keep the two piles apart', async () => {
            // Forty harmless backlog items look exactly like forty providers
            // who cannot answer a complaint, once summed.
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { count: 12, byType: { reviews: 9, replies: 3 } } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useHostTradePendingCounts(), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data?.byType.reviews).toBe(9);
            expect(result.current.data?.byType.replies).toBe(3);
            expect(result.current.data?.count).toBe(12);
        });
    });

    describe('recording a verdict', () => {
        it('should post the decision to the review moderate endpoint', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { review: { id: 'review-1' } } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useModerateHostTradeReview(), { wrapper });

            result.current.mutate({
                id: 'review-1',
                decision: 'REJECTED',
                reason: 'Datos personales'
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            const call = mockFetchApi.mock.calls.at(-1)?.[0];
            expect(call.path).toBe('/api/v1/admin/host-trades/reviews/review-1/moderate');
            expect(call.method).toBe('POST');
            expect(call.body).toEqual({ decision: 'REJECTED', reason: 'Datos personales' });
        });

        it('should omit an empty reason instead of sending a blank one', async () => {
            // The reason is stored on the row and shown to its author. An empty
            // string is not a reason — it reads as one that was given and lost.
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { review: { id: 'review-1' } } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useModerateHostTradeReview(), { wrapper });

            result.current.mutate({ id: 'review-1', decision: 'APPROVED', reason: '' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(mockFetchApi.mock.calls.at(-1)?.[0].body).toEqual({ decision: 'APPROVED' });
        });

        it('should refresh the badge after a review verdict too', async () => {
            // The twin of the reply assertion below, and NOT redundant with it:
            // the two verdicts run through separate hooks, so invalidating from
            // the moderation root in one of them proves nothing about the
            // other. A review verdict that only refreshed the review list would
            // leave the badge advertising work already done.
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { review: { id: 'review-1' } } }
            });

            const { wrapper, queryClient } = buildWrapper();
            const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
            const { result } = renderHook(() => useModerateHostTradeReview(), { wrapper });

            result.current.mutate({ id: 'review-1', decision: 'REJECTED' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['host-trade-moderation'] });
        });

        it('should refresh the badge as well as the list it changed', async () => {
            // A verdict moves both. If only the list refreshed, the badge would
            // keep advertising work that is already done.
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { reply: { id: 'reply-1' } } }
            });

            const { wrapper, queryClient } = buildWrapper();
            const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
            const { result } = renderHook(() => useModerateHostTradeReply(), { wrapper });

            result.current.mutate({ id: 'reply-1', decision: 'APPROVED' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['host-trade-moderation'] });
        });

        it('should post a reply verdict to the reply endpoint', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { reply: { id: 'reply-1' } } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useModerateHostTradeReply(), { wrapper });

            result.current.mutate({ id: 'reply-1', decision: 'REJECTED' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(mockFetchApi.mock.calls.at(-1)?.[0].path).toBe(
                '/api/v1/admin/host-trades/replies/reply-1/moderate'
            );
        });
    });
});
