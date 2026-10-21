// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { SubscriptionRevocationScreen } from '../SubscriptionRevocationScreen';

function translateEs(key: string): string {
    let node: unknown = es;
    for (const part of key.replace(/^admin-billing\./, '').split('.')) {
        node =
            typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[part]
                : undefined;
    }
    return typeof node === 'string' ? node : key;
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));
vi.mock('../RevocationOpenRefunds', () => ({
    RevocationOpenRefunds: () => <div data-testid="open-refunds-probe" />
}));
const permissions = vi.fn<() => PermissionEnum[]>(() => [
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
]);
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => permissions() }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
const statusState: {
    data: string | undefined;
    isLoading: boolean;
    isFetching: boolean;
    error?: unknown;
} = {
    data: 'CANCELLED',
    isLoading: false,
    isFetching: false
};
const subscriptionStatus = vi.fn((_input: unknown) => statusState);
vi.mock('../../hooks/useSubscriptionStatus', () => ({
    useSubscriptionStatus: (input: unknown) => subscriptionStatus(input)
}));

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const refusal = new ApiError('refused', {
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
const previewState = {
    isLoading: false,
    error: refusal as unknown,
    data: undefined
};
vi.mock('../../hooks/useSubscriptionRevocation', () => ({
    useSubscriptionRevocationPreview: () => ({
        ...previewState,
        isFetching: false,
        refetch: vi.fn()
    }),
    useRevokeSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

beforeEach(() => {
    statusState.data = 'CANCELLED';
    statusState.isLoading = false;
    statusState.isFetching = false;
    statusState.error = undefined;
    previewState.error = refusal;
    permissions.mockReturnValue([
        PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
        PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
    ]);
});

describe('TEST:1728:1 AC:1728:1-2', () => {
    it('shows a neutral already-cancelled notice with the open refunds list', () => {
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        expect(screen.getByTestId('subscription-revocation-already-cancelled')).toHaveAttribute(
            'role',
            'status'
        );
        expect(screen.getByTestId('subscription-revocation-already-cancelled')).toHaveTextContent(
            translateEs('admin-billing.subscriptionRevocation.alreadyCancelled')
        );
        expect(screen.queryByTestId('subscription-revocation-blocked')).not.toBeInTheDocument();
        expect(screen.queryByText(/No se canceló nada/)).not.toBeInTheDocument();
        expect(screen.queryByTestId('subscription-revocation-confirm')).not.toBeInTheDocument();
        expect(screen.queryByTestId('subscription-revocation-note')).not.toBeInTheDocument();
        expect(screen.getByTestId('open-refunds-probe')).toBeInTheDocument();
    });
});

describe('TEST:1728:2 AC:1728:3', () => {
    it('uses the cautious refusal title for a confirmed non-cancelled state', () => {
        statusState.data = 'TRIALING';
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        const blocked = screen.getByTestId('subscription-revocation-blocked');
        expect(blocked).toHaveAttribute('data-reason', 'REVOCATION_STATE_NOT_ALLOWED');
        expect(blocked).toHaveTextContent('No se puede revocar.');
        expect(blocked).not.toHaveTextContent('No se canceló nada');
    });

    it('does not request inspection without permission and keeps the cautious refusal', () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]);
        statusState.data = undefined;
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        expect(screen.getByTestId('subscription-revocation-blocked')).toHaveTextContent(
            'No se puede revocar.'
        );
        expect(screen.getByTestId('subscription-revocation-blocked')).not.toHaveTextContent(
            'No se canceló nada'
        );
        expect(subscriptionStatus).toHaveBeenCalledWith({ subscriptionId: id, enabled: false });
    });

    it('keeps the cautious refusal when the status read fails', () => {
        statusState.data = undefined;
        statusState.error = new ApiError('failed', { status: 500, body: {} });
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        expect(screen.getByTestId('subscription-revocation-blocked')).toHaveTextContent(
            'No se puede revocar.'
        );
        expect(screen.getByTestId('subscription-revocation-blocked')).not.toHaveTextContent(
            'No se canceló nada'
        );
    });

    it('shows the existing loading state while status inspection is pending', () => {
        statusState.data = undefined;
        statusState.isLoading = true;
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        expect(screen.getByTestId('subscription-revocation-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('subscription-revocation-blocked')).not.toBeInTheDocument();
    });
});

describe('TEST:1728:3 AC:1728:3', () => {
    it.each([
        'REFUND_EXCEEDS_BALANCE',
        'REVOCATION_WINDOW_CLOSED'
    ])('keeps the original intro and does not enable a status read for %s', (reason) => {
        previewState.error = new ApiError('refused', {
            status: 422,
            body: { success: false, error: { code: 'X', message: 'refused', reason } }
        });
        render(React.createElement(SubscriptionRevocationScreen, { subscriptionId: id }));
        const blocked = screen.getByTestId('subscription-revocation-blocked');
        expect(blocked).toHaveTextContent('No se puede revocar. No se canceló nada.');
        expect(subscriptionStatus).not.toHaveBeenCalledWith({ subscriptionId: id, enabled: true });
    });
});
