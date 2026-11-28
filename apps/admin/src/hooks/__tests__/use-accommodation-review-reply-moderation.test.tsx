/**
 * @file use-accommodation-review-reply-moderation.test.tsx
 * @description The accommodation-review reply moderation hooks (HOS-2675).
 *
 * The assertions concentrate on what fails SILENTLY: a filter dropped from the
 * query string, a response unwrapped one level short, and a cache not
 * invalidated after a verdict.
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
    useAccommodationReviewRepliesQueue,
    useModerateAccommodationReviewReply
} from '../use-accommodation-review-reply-moderation';

function buildWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper, queryClient };
}

function lastPath(): string {
    return mockFetchApi.mock.calls.at(-1)?.[0]?.path ?? '';
}

describe('use-accommodation-review-reply-moderation', () => {
    beforeEach(() => {
        mockFetchApi.mockReset();
    });

    describe('the reply queue', () => {
        it('should unwrap the page the API nested twice', async () => {
            mockFetchApi.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        items: [{ id: 'reply-1' }],
                        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                    }
                }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useAccommodationReviewRepliesQueue(), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data?.items).toEqual([{ id: 'reply-1' }]);
            expect(result.current.data?.pagination.total).toBe(1);
        });

        it('should read the replies endpoint for the accommodation', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(
                () =>
                    useAccommodationReviewRepliesQueue({
                        accommodationId: 'acc-1',
                        moderationState: 'PENDING',
                        page: 2
                    }),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).toContain('/admin/accommodations/reviews/replies');
            expect(lastPath()).toContain('accommodationId=acc-1');
            expect(lastPath()).toContain('moderationState=PENDING');
            expect(lastPath()).toContain('page=2');
        });

        it('should omit a moderation state that was not set', async () => {
            mockFetchApi.mockResolvedValue({
                data: { success: true, data: { items: [], pagination: {} } }
            });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(
                () => useAccommodationReviewRepliesQueue({ accommodationId: 'acc-1' }),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(lastPath()).not.toContain('moderationState');
            expect(lastPath()).not.toContain('undefined');
        });
    });

    describe('recording a verdict', () => {
        it('should post the decision to the reply moderate endpoint', async () => {
            mockFetchApi.mockResolvedValue({ data: { data: { id: 'reply-1' } } });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useModerateAccommodationReviewReply(), {
                wrapper
            });

            result.current.mutate({
                id: 'reply-1',
                decision: 'REJECTED',
                reason: 'Datos personales'
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            const call = mockFetchApi.mock.calls.at(-1)?.[0];
            expect(call.path).toBe('/api/v1/admin/accommodations/reviews/replies/reply-1/moderate');
            expect(call.method).toBe('POST');
            expect(call.body).toEqual({ decision: 'REJECTED', reason: 'Datos personales' });
        });

        it('should omit an empty reason instead of sending a blank one', async () => {
            mockFetchApi.mockResolvedValue({ data: { data: { id: 'reply-1' } } });

            const { wrapper } = buildWrapper();
            const { result } = renderHook(() => useModerateAccommodationReviewReply(), {
                wrapper
            });

            result.current.mutate({ id: 'reply-1', decision: 'APPROVED', reason: '' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(mockFetchApi.mock.calls.at(-1)?.[0].body).toEqual({ decision: 'APPROVED' });
        });

        it('should invalidate the moderation root after a verdict', async () => {
            mockFetchApi.mockResolvedValue({ data: { data: { id: 'reply-1' } } });

            const { wrapper, queryClient } = buildWrapper();
            const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
            const { result } = renderHook(() => useModerateAccommodationReviewReply(), {
                wrapper
            });

            result.current.mutate({ id: 'reply-1', decision: 'REJECTED' });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(invalidate).toHaveBeenCalledWith({
                queryKey: ['accommodation-review-reply-moderation']
            });
        });
    });
});
