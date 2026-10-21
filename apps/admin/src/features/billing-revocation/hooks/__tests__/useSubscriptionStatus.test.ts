import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { buildSubscriptionStatusPath, useSubscriptionStatus } from '../useSubscriptionStatus';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const createWrapper = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);
};

afterEach(() => vi.clearAllMocks());

describe('TEST:1728:5 AC:1728:5 useSubscriptionStatus', () => {
    it('reads the existing inspection path and returns the status', async () => {
        vi.mocked(fetchApi).mockResolvedValue({ data: { data: { status: 'CANCELLED' } } } as never);
        const { result } = renderHook(
            () => useSubscriptionStatus({ subscriptionId: id, enabled: true }),
            { wrapper: createWrapper() }
        );
        await waitFor(() => expect(result.current.data).toBe('CANCELLED'));
        expect(buildSubscriptionStatusPath({ subscriptionId: id })).toBe(
            `/api/v1/admin/billing-subscription/${id}`
        );
        expect(fetchApi).toHaveBeenCalledWith({ path: `/api/v1/admin/billing-subscription/${id}` });
        expect(fetchApi).toHaveBeenCalledTimes(1);
    });

    it('does not read when disabled', async () => {
        const { result } = renderHook(
            () => useSubscriptionStatus({ subscriptionId: id, enabled: false }),
            { wrapper: createWrapper() }
        );
        await waitFor(() => expect(result.current.fetchStatus).not.toBe('fetching'));
        expect(fetchApi).not.toHaveBeenCalled();
    });

    it('does not retry a failed status read', async () => {
        vi.mocked(fetchApi).mockRejectedValue(new Error('unavailable'));
        const { result } = renderHook(
            () => useSubscriptionStatus({ subscriptionId: id, enabled: true }),
            { wrapper: createWrapper() }
        );
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(fetchApi).toHaveBeenCalledTimes(1);
    });
});
