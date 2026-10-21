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
const subscriptionStatus = vi.fn(() => ({
    data: 'CANCELLED',
    isLoading: false,
    isFetching: false
}));
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
    data: undefined as SubscriptionRevocationPreviewResponse | undefined
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
