// @vitest-environment jsdom
/**
 * Tests for `useSubscriptionRevocation` (HOS-1678, action 8 with reason revocation).
 *
 * The hooks decide WHICH subscription the server reads and revokes and WHICH
 * payment the person confirmed: a wrong path revokes nothing (404) or another
 * row, and a wrong `expectedPaymentId` confirms a payment nobody saw. Both are
 * asserted on the exact path, method and body handed to `fetchApi`.
 */

import type { SubscriptionRevocationPreviewResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    subscriptionRevocationPreviewQueryKey,
    useRevokeSubscriptionMutation,
    useSubscriptionRevocationPreview
} from '../useSubscriptionRevocation';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const SUBSCRIPTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PATH = `/api/v1/admin/billing-subscription/${SUBSCRIPTION_ID}/revocation`;

const PREVIEW: SubscriptionRevocationPreviewResponse = {
    subscriptionId: SUBSCRIPTION_ID,
    origin: 'ACTIVE',
    payment: {
        source: 'PAYMENT',
        id: PAYMENT_ID,
        amount: 1800000,
        currency: 'ARS',
        chargedAt: '2026-10-02T15:00:00.000Z',
        ownerSubscriptionId: SUBSCRIPTION_ID
    },
    windowEndsAt: '2026-10-12T03:00:00.000Z',
    effects: { cancelsAuthorization: true, endsServiceAt: 'NOW', requestsRefund: true }
};

const RESULT = {
    subscriptionId: SUBSCRIPTION_ID,
    status: 'CANCELLED',
    origin: 'ACTIVE',
    serviceEndedAt: '2026-10-05T12:00:00.000Z',
    refundId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    refundAmount: 1800000,
    payment: { source: 'PAYMENT', id: PAYMENT_ID },
    cancelCall: 'SENT'
} as const;

/** QueryClientProvider wrapper. */
function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('HOS-1678 revocation hooks', () => {
    it('the preview GETs /api/v1/admin/billing-subscription/:id/revocation', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: PREVIEW }, status: 200 });

        // Act
        const { result } = renderHook(
            () =>
                useSubscriptionRevocationPreview({
                    subscriptionId: SUBSCRIPTION_ID,
                    enabled: true
                }),
            { wrapper: createWrapper(createClient()) }
        );

        // Assert
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({ path: PATH });
        expect(result.current.data).toEqual(PREVIEW);
    });

    it('the preview does not call the API with enabled: false', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: PREVIEW }, status: 200 });

        // Act
        const { result } = renderHook(
            () =>
                useSubscriptionRevocationPreview({
                    subscriptionId: SUBSCRIPTION_ID,
                    enabled: false
                }),
            { wrapper: createWrapper(createClient()) }
        );
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(mockedFetchApi).not.toHaveBeenCalled();
        expect(result.current.fetchStatus).toBe('idle');
    });

    it('the act POSTs { expectedPaymentId, note } with the trimmed note', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useRevokeSubscriptionMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        const outcome = await result.current.mutateAsync({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID,
            note: '  lo pidió por correo  '
        });

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: PATH,
            method: 'POST',
            body: { expectedPaymentId: PAYMENT_ID, note: 'lo pidió por correo' }
        });
        expect(outcome).toEqual(RESULT);
    });

    it('the act POSTs only { expectedPaymentId } without a note', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useRevokeSubscriptionMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        await result.current.mutateAsync({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID
        });

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: PATH,
            method: 'POST',
            body: { expectedPaymentId: PAYMENT_ID }
        });
    });

    it('the act does not send a note made only of whitespace', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const { result } = renderHook(() => useRevokeSubscriptionMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        await result.current.mutateAsync({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID,
            note: '    '
        });

        // Assert
        const call = mockedFetchApi.mock.calls[0]?.[0];
        expect(call?.body).toEqual({ expectedPaymentId: PAYMENT_ID });
        expect(call?.body).not.toHaveProperty('note');
    });

    it('the act invalidates the preview of that subscription after succeeding', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: RESULT }, status: 200 });
        const queryClient = createClient();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useRevokeSubscriptionMutation(), {
            wrapper: createWrapper(queryClient)
        });

        // Act
        await result.current.mutateAsync({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID
        });

        // Assert
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: subscriptionRevocationPreviewQueryKey({ subscriptionId: SUBSCRIPTION_ID })
        });
    });
});
