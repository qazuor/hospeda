// @vitest-environment jsdom

import {
    PermissionEnum,
    type SubscriptionRevocationPreviewResponse,
    type SubscriptionRevocationResponse
} from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { SubscriptionRevocationScreen } from '../SubscriptionRevocationScreen';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const permissions = vi.fn(() => [
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
    PermissionEnum.BILLING_SETTLE_EXTERNAL
]);
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions(),
    useHasAllPermissions: (required: PermissionEnum[]) =>
        required.every((permission) => permissions().includes(permission)),
    useHasPermission: (permission: PermissionEnum) => permissions().includes(permission)
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const paymentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const path = `/api/v1/admin/billing-subscription/${id}/revocation`;
const preview: SubscriptionRevocationPreviewResponse = {
    subscriptionId: id,
    origin: 'ACTIVE',
    payment: {
        source: 'PAYMENT',
        id: paymentId,
        amount: 100,
        currency: 'ARS',
        chargedAt: '2026-10-02T15:00:00.000Z',
        ownerSubscriptionId: id
    },
    windowEndsAt: '2026-10-12T03:00:00.000Z',
    effects: { cancelsAuthorization: true, endsServiceAt: 'NOW', requestsRefund: true }
};
const result: SubscriptionRevocationResponse = {
    subscriptionId: id,
    status: 'CANCELLED',
    origin: 'ACTIVE',
    serviceEndedAt: '2026-10-05T15:00:00.000Z',
    refundId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    refundAmount: 100,
    payment: { source: 'PAYMENT', id: paymentId },
    cancelCall: 'FAILED'
};

describe('TEST:1728:4 AC:1728:4', () => {
    it('keeps the successful result when invalidation preview returns state-not-allowed', async () => {
        const fetchMock = vi.mocked(fetchApi);
        let previewGets = 0;
        fetchMock.mockImplementation(async (input) => {
            if (input.path === path && input.method === 'POST')
                return { data: { data: result } } as never;
            if (input.path === path) {
                previewGets += 1;
                if (previewGets === 1) return { data: { data: preview } } as never;
                throw new ApiError('refused', {
                    status: 409,
                    body: {
                        success: false,
                        error: {
                            code: 'ALREADY_EXISTS',
                            message: 'refused',
                            reason: 'REVOCATION_STATE_NOT_ALLOWED'
                        }
                    }
                });
            }
            if (input.path.endsWith('/open-refunds'))
                return { data: { data: { items: [] } } } as never;
            throw new Error(`Unexpected fetch: ${input.path}`);
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <SubscriptionRevocationScreen subscriptionId={id} />
            </QueryClientProvider>
        );

        fireEvent.click(await screen.findByTestId('subscription-revocation-confirm'));

        await waitFor(() =>
            expect(
                fetchMock.mock.calls.filter(([input]) => input.path === path && !input.method)
            ).toHaveLength(2)
        );
        expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ path, method: 'POST' }));
        await waitFor(() =>
            expect(screen.getByTestId('subscription-revocation-result')).toBeInTheDocument()
        );
        expect(screen.getByTestId('subscription-revocation-settlement-form')).toBeInTheDocument();
        expect(screen.queryByTestId('subscription-revocation-blocked')).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('subscription-revocation-already-cancelled')
        ).not.toBeInTheDocument();
        client.clear();
    });
});
