// @vitest-environment jsdom
/** Tests for the action 7 mutation path, exact body and list invalidation. */

import type { ReconciliationMarkLiftResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { useLiftReconciliationMarkMutation } from '../useLiftReconciliationMark';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const mockedFetchApi = vi.mocked(fetchApi);
const MARK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESULT: ReconciliationMarkLiftResponse = {
    markId: MARK_ID,
    reason: 'PAGO_TARDIO_RECHAZADO',
    liftedAt: '2026-10-18T12:00:00.000Z',
    liftedBy: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    version: 4,
    resolvedWithoutRefund: [{ source: 'PAYMENT', paymentId: PAYMENT_ID }]
};

function wrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function client() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}

afterEach(() => vi.clearAllMocks());

describe('TEST:1697:13 AC:1697:5 hook', () => {
    it('POSTs the exact lift path and body with the trimmed note', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useLiftReconciliationMarkMutation(), {
            wrapper: wrapper(client())
        });
        await result.current.mutateAsync({
            markId: MARK_ID,
            expectedVersion: 3,
            resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: PAYMENT_ID }],
            note: '  reviewed  '
        });
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/billing-reconciliation/marks/${MARK_ID}/lift`,
            method: 'POST',
            body: {
                expectedVersion: 3,
                resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: PAYMENT_ID }],
                note: 'reviewed'
            }
        });
    });

    it('omits a note made only of whitespace', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useLiftReconciliationMarkMutation(), {
            wrapper: wrapper(client())
        });
        await result.current.mutateAsync({
            markId: MARK_ID,
            expectedVersion: 3,
            resolveWithoutRefund: [],
            note: '   '
        });
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/billing-reconciliation/marks/${MARK_ID}/lift`,
            method: 'POST',
            body: { expectedVersion: 3, resolveWithoutRefund: [] }
        });
    });

    it('invalidates the actionable mark list after success', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const queryClient = client();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useLiftReconciliationMarkMutation(), {
            wrapper: wrapper(queryClient)
        });
        await result.current.mutateAsync({
            markId: MARK_ID,
            expectedVersion: 3,
            resolveWithoutRefund: []
        });
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({
                queryKey: ['billing-reconciliation', 'marks']
            })
        );
    });
});
