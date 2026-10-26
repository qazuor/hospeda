// @vitest-environment jsdom
import type { AdminSubscriptionCancellationPreviewResponse } from '@repo/schemas';
import { CancellationReasonEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import {
    buildSubscriptionCancellationPath,
    subscriptionCancellationPreviewQueryKey,
    useCancelSubscriptionMutation,
    useSubscriptionCancellationPreview
} from '../useSubscriptionCancellation';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const mockedFetchApi = vi.mocked(fetchApi);
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PATH = `/api/v1/admin/billing-subscription/${ID}/cancellation`;
const PREVIEW: AdminSubscriptionCancellationPreviewResponse = {
    subscriptionId: ID,
    vertical: 'accommodation',
    paymentMethod: 'CARD',
    origin: 'SUSPENDED',
    addons: []
};
const RESULT = {
    subscriptionId: ID,
    outcome: 'CANCELLED',
    transition: 'S23',
    serviceEndsAt: '2026-10-05T15:00:00.000Z',
    cancelCall: 'SENT'
} as const;
function wrapper(client: QueryClient) {
    return ({ children }: { readonly children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);
}
function client() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}
afterEach(() => vi.clearAllMocks());

describe('TEST:1696:3 AC:1696:3 cancellation hook', () => {
    it('builds the registered path and GETs the preview', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: PREVIEW }, status: 200 });
        const { result } = renderHook(
            () => useSubscriptionCancellationPreview({ subscriptionId: ID, enabled: true }),
            { wrapper: wrapper(client()) }
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(buildSubscriptionCancellationPath({ subscriptionId: ID })).toBe(PATH);
        expect(mockedFetchApi).toHaveBeenCalledWith({ path: PATH });
        expect(result.current.data).toEqual(PREVIEW);
    });
    it('POSTs the preview origin and trimmed note', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useCancelSubscriptionMutation(), {
            wrapper: wrapper(client())
        });
        await result.current.mutateAsync({
            subscriptionId: ID,
            expectedOrigin: 'SUSPENDED',
            note: '  support asked  '
        });
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: PATH,
            method: 'POST',
            body: { expectedOrigin: 'SUSPENDED', note: 'support asked' }
        });
    });
    it('POSTs no note when omitted or blank', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useCancelSubscriptionMutation(), {
            wrapper: wrapper(client())
        });
        await result.current.mutateAsync({
            subscriptionId: ID,
            expectedOrigin: 'SUSPENDED',
            note: '   '
        });
        await result.current.mutateAsync({ subscriptionId: ID, expectedOrigin: 'SUSPENDED' });
        expect(mockedFetchApi).toHaveBeenNthCalledWith(1, {
            path: PATH,
            method: 'POST',
            body: { expectedOrigin: 'SUSPENDED' }
        });
        expect(mockedFetchApi).toHaveBeenNthCalledWith(2, {
            path: PATH,
            method: 'POST',
            body: { expectedOrigin: 'SUSPENDED' }
        });
        expect(mockedFetchApi.mock.calls[0]?.[0]?.body).not.toHaveProperty('note');
        expect(mockedFetchApi.mock.calls[1]?.[0]?.body).not.toHaveProperty('note');
    });
    it('TEST:1878:24b includes only a chosen reason and keeps expectedOrigin required', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useCancelSubscriptionMutation(), {
            wrapper: wrapper(client())
        });
        await result.current.mutateAsync({ subscriptionId: ID, expectedOrigin: 'SUSPENDED' });
        await result.current.mutateAsync({
            subscriptionId: ID,
            expectedOrigin: 'SUSPENDED',
            reason: CancellationReasonEnum.SEASONAL_PAUSE
        });
        expect(mockedFetchApi).toHaveBeenNthCalledWith(1, {
            path: PATH,
            method: 'POST',
            body: { expectedOrigin: 'SUSPENDED' }
        });
        expect(mockedFetchApi).toHaveBeenNthCalledWith(2, {
            path: PATH,
            method: 'POST',
            body: {
                expectedOrigin: 'SUSPENDED',
                reason: CancellationReasonEnum.SEASONAL_PAUSE
            }
        });
    });
    it('invalidates the preview after success', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const qc = client();
        const invalidate = vi.spyOn(qc, 'invalidateQueries');
        const { result } = renderHook(() => useCancelSubscriptionMutation(), {
            wrapper: wrapper(qc)
        });
        await result.current.mutateAsync({ subscriptionId: ID, expectedOrigin: 'SUSPENDED' });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: subscriptionCancellationPreviewQueryKey({ subscriptionId: ID })
        });
    });
    it('invalidates the preview after CANCELLATION_ORIGIN_CHANGED', async () => {
        mockedFetchApi.mockRejectedValue(
            new ApiError('changed', {
                status: 409,
                body: { error: { reason: 'CANCELLATION_ORIGIN_CHANGED' } }
            })
        );
        const qc = client();
        const invalidate = vi.spyOn(qc, 'invalidateQueries');
        const { result } = renderHook(() => useCancelSubscriptionMutation(), {
            wrapper: wrapper(qc)
        });
        await expect(
            result.current.mutateAsync({ subscriptionId: ID, expectedOrigin: 'SUSPENDED' })
        ).rejects.toThrow();
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({
                queryKey: subscriptionCancellationPreviewQueryKey({ subscriptionId: ID })
            })
        );
    });
});
