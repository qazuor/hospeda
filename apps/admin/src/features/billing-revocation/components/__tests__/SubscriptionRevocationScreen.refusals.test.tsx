// @vitest-environment jsdom
/**
 * Tests for `SubscriptionRevocationScreen` (HOS-1678, action 8 with reason
 * revocation, S36).
 *
 * What would make the screen silently wrong:
 *  - an admin without `BILLING_CANCEL_SUBSCRIPTION` (even holding other billing
 *    permissions) sees it;
 *  - the confirmation does not say the three things, or the amount, the charge
 *    date or the last day of the window;
 *  - a refused preview (Coord-351: an open refund for the whole charge) offers
 *    a confirm button;
 *  - the act sends a payment the person did not see, or retries a 409 alone;
 *  - a successful revocation can be confirmed again.
 */

import esAdminBilling from '@repo/i18n/locales/es/admin-billing.json';
import {
    PermissionEnum,
    type SubscriptionRevocationPreviewResponse,
    type SubscriptionRevocationResponse
} from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { KNOWN_REVOCATION_REASONS } from '../../revocation-reasons';
import { SubscriptionRevocationScreen } from '../SubscriptionRevocationScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Resolves an `admin-billing.*` key against the REAL Spanish copy. */
function translateEs(key: string, params?: Readonly<Record<string, unknown>>): string {
    const path = key.replace(/^admin-billing\./, '').split('.');
    let node: unknown = esAdminBilling;
    for (const segment of path) {
        node =
            typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[segment]
                : undefined;
    }
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce<string>(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        node
    );
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));
vi.mock('../RevocationRefundSettlement', () => ({ RevocationRefundSettlement: () => null }));
vi.mock('../RevocationOpenRefunds', () => ({ RevocationOpenRefunds: () => null }));

const permissions = vi.fn<() => PermissionEnum[]>(() => []);

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => permissions()
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ isLoading: false })
}));

const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast })
}));

const SUBSCRIPTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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
    refundId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    refundAmount: 1800000,
    payment: { source: 'PAYMENT', id: PAYMENT_ID },
    cancelCall: 'FAILED'
};

interface PreviewState {
    isLoading: boolean;
    error: unknown;
    data: SubscriptionRevocationPreviewResponse | undefined;
}

const previewState: PreviewState = { isLoading: false, error: null, data: READY };
const refetch = vi.fn();
const previewInputs = vi.fn();
const mutateAsync = vi.fn();

vi.mock('../../hooks/useSubscriptionStatus', () => ({
    useSubscriptionStatus: () => ({ data: undefined, isLoading: false })
}));
vi.mock('../../hooks/useSubscriptionRevocation', () => ({
    useSubscriptionRevocationPreview: (input: { subscriptionId: string; enabled: boolean }) => {
        previewInputs(input);
        return { ...previewState, isFetching: false, refetch };
    },
    useRevokeSubscriptionMutation: () => ({ mutateAsync, isPending: false })
}));

/** An API refusal shaped like the route's `{ success: false, error: { reason } }`. */
function refusal(status: number, reason?: string): ApiError {
    return new ApiError('refused', {
        status,
        body: { success: false, error: { code: 'X', message: 'refused', reason } }
    });
}

function renderScreen(subscriptionId = SUBSCRIPTION_ID) {
    render(React.createElement(SubscriptionRevocationScreen, { subscriptionId }));
}

function expectNoConfirm() {
    expect(screen.queryByTestId('subscription-revocation-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subscription-revocation-note')).not.toBeInTheDocument();
}

beforeEach(() => {
    vi.clearAllMocks();
    previewState.isLoading = false;
    previewState.error = null;
    previewState.data = READY;
    mutateAsync.mockResolvedValue(RESULT);
    refetch.mockResolvedValue({});
    permissions.mockReturnValue([PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]);
});

describe('HOS-1678 revocation preview refusals', () => {
    it('(d) REFUND_EXCEEDS_BALANCE on the preview (Coord-351) blocks with no confirm and no note', () => {
        // Arrange
        previewState.data = undefined;
        previewState.error = refusal(422, 'REFUND_EXCEEDS_BALANCE');

        // Act
        renderScreen();

        // Assert
        const blocked = screen.getByTestId('subscription-revocation-blocked');
        expect(blocked).toHaveAttribute('data-reason', 'REFUND_EXCEEDS_BALANCE');
        expect(blocked).toHaveTextContent('No se puede revocar. No se canceló nada.');
        expect(blocked).toHaveTextContent('devoluciones pedidas o hechas por todo su monto');
        expect(screen.queryByTestId('subscription-revocation-ready')).not.toBeInTheDocument();
        expectNoConfirm();
    });

    it.each(
        KNOWN_REVOCATION_REASONS.filter(
            (reason) =>
                reason !== 'SUBSCRIPTION_NOT_FOUND' &&
                reason !== 'ADMINISTRATIVE_ACTION_FORBIDDEN' &&
                reason !== 'REFUND_EXCEEDS_BALANCE'
        )
    )('(e) %s on the preview shows its copy and no confirm', (reason) => {
        // Arrange
        previewState.data = undefined;
        previewState.error = refusal(reason.startsWith('REVOCATION_WINDOW') ? 422 : 409, reason);
        const expected = (esAdminBilling.subscriptionRevocation.blocked as Record<string, string>)[
            reason
        ];

        // Act
        renderScreen();

        // Assert
        const blocked = screen.getByTestId('subscription-revocation-blocked');
        expect(blocked).toHaveAttribute('data-reason', reason);
        expect(blocked).toHaveTextContent(expected ?? 'MISSING');
        expectNoConfirm();
    });

    it('(e) 404 and 403 on the preview read as unavailable, with no confirm', () => {
        // Arrange
        previewState.data = undefined;
        previewState.error = refusal(404, 'SUBSCRIPTION_NOT_FOUND');

        // Act
        const { unmount } = render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );

        // Assert
        expect(screen.getByTestId('subscription-revocation-unavailable')).toHaveTextContent(
            'Esta suscripción no existe.'
        );
        expectNoConfirm();

        // Arrange + Act: 403 without reason (the route's early permission check)
        unmount();
        previewState.error = refusal(403);
        renderScreen();

        // Assert
        expect(screen.getByTestId('subscription-revocation-unavailable')).toHaveTextContent(
            'No podés revocar esta suscripción'
        );
        expectNoConfirm();
    });

    it('(f) an unknown reason and a 5xx show generic copy, with no confirm', () => {
        // Arrange
        previewState.data = undefined;
        previewState.error = refusal(409, 'RETAINED_PAYMENT_SUCCESSION_OPEN');

        // Act
        const { unmount } = render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );

        // Assert
        const blocked = screen.getByTestId('subscription-revocation-blocked');
        expect(blocked).toHaveAttribute('data-reason', 'RETAINED_PAYMENT_SUCCESSION_OPEN');
        expect(blocked).toHaveTextContent(
            'No se puede revocar ahora (código RETAINED_PAYMENT_SUCCESSION_OPEN).'
        );
        expectNoConfirm();

        // Arrange + Act: a 5xx, even holding a stale preview
        unmount();
        previewState.data = READY;
        previewState.error = refusal(500);
        renderScreen();

        // Assert
        expect(screen.getByTestId('subscription-revocation-unavailable')).toHaveTextContent(
            'No pudimos revisar la suscripción'
        );
        expect(screen.queryByTestId('subscription-revocation-ready')).not.toBeInTheDocument();
        expectNoConfirm();
    });
});
