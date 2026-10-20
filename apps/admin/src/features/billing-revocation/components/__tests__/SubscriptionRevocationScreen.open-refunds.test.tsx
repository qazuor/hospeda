// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import {
    PermissionEnum,
    type SubscriptionRevocationPreviewResponse,
    type SubscriptionRevocationResponse
} from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { SubscriptionRevocationScreen } from '../SubscriptionRevocationScreen';

function translateEs(key: string, params?: Readonly<Record<string, unknown>>): string {
    let node: unknown = es;
    for (const segment of key.replace(/^admin-billing\./, '').split('.')) {
        node =
            typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[segment]
                : undefined;
    }
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        node
    );
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));
vi.mock('../RevocationRefundSettlement', () => ({ RevocationRefundSettlement: () => null }));
vi.mock('../RevocationOpenRefunds', () => ({
    RevocationOpenRefunds: ({ subscriptionId }: { subscriptionId: string }) => (
        <div
            data-testid="open-refunds-probe"
            data-subscription-id={subscriptionId}
        />
    )
}));

const permissions = vi.fn<() => PermissionEnum[]>(() => [
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
]);
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => permissions() }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const SUBSCRIPTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const READY: SubscriptionRevocationPreviewResponse = {
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
const RESULT: SubscriptionRevocationResponse = {
    subscriptionId: SUBSCRIPTION_ID,
    status: 'CANCELLED',
    origin: 'ACTIVE',
    serviceEndedAt: '2026-10-05T15:00:00.000Z',
    refundId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    refundAmount: 1800000,
    payment: { source: 'PAYMENT', id: PAYMENT_ID },
    cancelCall: 'FAILED'
};
const previewState: {
    isLoading: boolean;
    error: unknown;
    data: SubscriptionRevocationPreviewResponse | undefined;
} = {
    isLoading: false,
    error: null,
    data: READY
};
const refetch = vi.fn();
const mutateAsync = vi.fn();
vi.mock('../../hooks/useSubscriptionRevocation', () => ({
    useSubscriptionRevocationPreview: () => ({ ...previewState, isFetching: false, refetch }),
    useRevokeSubscriptionMutation: () => ({ mutateAsync, isPending: false })
}));

beforeEach(() => {
    vi.clearAllMocks();
    previewState.isLoading = false;
    previewState.error = null;
    previewState.data = READY;
    mutateAsync.mockResolvedValue(RESULT);
});

describe('TEST:1711:12 AC:1711:11 open-refunds placement on the S36 screen', () => {
    it('TEST:1711:12 AC:1711:11 shows the refusal and the list probe after a reload is refused', () => {
        previewState.error = new ApiError('refused', {
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
        render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );
        expect(screen.getByTestId('subscription-revocation-blocked')).toBeInTheDocument();
        expect(screen.getByTestId('open-refunds-probe')).toHaveAttribute(
            'data-subscription-id',
            SUBSCRIPTION_ID
        );
    });

    it('TEST:1711:12 AC:1711:11 shows the list probe with a ready preview', () => {
        render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );
        expect(screen.getByTestId('open-refunds-probe')).toHaveAttribute(
            'data-subscription-id',
            SUBSCRIPTION_ID
        );
    });

    it('TEST:1711:12 AC:1711:11 hides the list probe after a successful revocation result appears', async () => {
        render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );
        expect(screen.getByTestId('open-refunds-probe')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('subscription-revocation-confirm'));
        await waitFor(() =>
            expect(screen.getByTestId('subscription-revocation-result')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('open-refunds-probe')).not.toBeInTheDocument();
    });
});
