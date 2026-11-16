/**
 * @file decide-refetch.test.tsx
 * Approve answering 409 (NOT_NEEDED, STALE, NOT_PENDING) must refetch the queue,
 * since the request is no longer what the list shows; a 500 must not.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import {
    LOCATION_EXCEPTION_REQUESTS_QUERY_KEY,
    useDecideLocationExceptionRequestMutation
} from '../hooks';

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApi: mocks.fetchApi }));

async function approve(status: number, reason: string) {
    mocks.fetchApi.mockRejectedValue(new ApiError('x', { status, body: { error: { reason } } }));
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDecideLocationExceptionRequestMutation(), { wrapper });
    await act(async () => {
        await result.current
            .mutateAsync({
                vertical: 'venues',
                requestId: 'r',
                decision: 'approve',
                reason: 'Motivo valido'
            })
            .catch(() => undefined);
    });
    return spy;
}

beforeEach(() => vi.clearAllMocks());

describe('useDecideLocationExceptionRequestMutation', () => {
    it.each([
        'LOCATION_EXCEPTION_NOT_NEEDED',
        'LOCATION_EXCEPTION_REQUEST_STALE',
        'LOCATION_EXCEPTION_REQUEST_NOT_PENDING'
    ])('refetches the queue on a 409 %s', async (reason) => {
        const spy = await approve(409, reason);
        expect(spy).toHaveBeenCalledWith({ queryKey: LOCATION_EXCEPTION_REQUESTS_QUERY_KEY });
    });

    it('does not refetch on a 500', async () => {
        const spy = await approve(500, 'X');
        expect(spy).not.toHaveBeenCalled();
    });
});
