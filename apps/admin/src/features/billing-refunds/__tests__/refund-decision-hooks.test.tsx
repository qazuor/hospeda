// @vitest-environment jsdom
/** Tests for the action 13 mutations: the request each one sends and what it refreshes. */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmRefundMutation, useDeclineRefundMutation } from '../hooks/useRefundDecision';

const api = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApi: api.fetchApi }));

const REFUND_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup() {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { invalidate, wrapper };
}

beforeEach(() => api.fetchApi.mockReset());

describe('HOS-2400 refund decision mutations', () => {
    it('confirm posts the explicit confirmation to that refund and refreshes the reconciliation lists', async () => {
        // Arrange
        const result = { refundId: REFUND_ID, status: 'CONFIRMED', outcome: 'SENT', calls: [] };
        api.fetchApi.mockResolvedValue({ data: { data: result } });
        const { invalidate, wrapper } = setup();
        const { result: hook } = renderHook(() => useConfirmRefundMutation(), { wrapper });

        // Act
        const answer = await hook.current.mutateAsync({ refundId: REFUND_ID });

        // Assert
        expect(answer).toEqual(result);
        expect(api.fetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/billing-refunds/${REFUND_ID}/confirm`,
            method: 'POST',
            body: { confirmed: true }
        });
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['billing-reconciliation'] })
        );
    });

    it('decline posts the explicit refusal to that refund and refreshes the reconciliation lists', async () => {
        // Arrange
        api.fetchApi.mockResolvedValue({
            data: { data: { refundId: REFUND_ID, status: 'FAILED' } }
        });
        const { invalidate, wrapper } = setup();
        const { result: hook } = renderHook(() => useDeclineRefundMutation(), { wrapper });

        // Act
        await hook.current.mutateAsync({ refundId: REFUND_ID });

        // Assert
        expect(api.fetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/billing-refunds/${REFUND_ID}/decline`,
            method: 'POST',
            body: { declined: true }
        });
        await waitFor(() =>
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['billing-reconciliation'] })
        );
    });
});
