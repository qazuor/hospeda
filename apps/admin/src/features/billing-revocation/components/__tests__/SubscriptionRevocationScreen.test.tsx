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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const PREDECESSOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
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

describe('HOS-1678 revocation confirmation screen', () => {
    it('(a) renders nothing without BILLING_CANCEL_SUBSCRIPTION, even with other billing permissions', () => {
        // Arrange
        permissions.mockReturnValue([
            PermissionEnum.BILLING_SETTINGS_WRITE,
            PermissionEnum.PAYMENT_REFUND
        ]);

        // Act
        renderScreen();

        // Assert
        expect(screen.queryByTestId('subscription-revocation-screen')).not.toBeInTheDocument();
        expect(screen.queryByTestId('subscription-revocation-confirm')).not.toBeInTheDocument();
    });

    it('(b) ready: says the three things, the amount, the charge date and the last day', () => {
        // Arrange + Act
        renderScreen();

        // Assert
        const ready = screen.getByTestId('subscription-revocation-ready');
        expect(ready).toHaveTextContent('Motivo: revocación del derecho de arrepentimiento.');
        expect(screen.getByTestId('subscription-revocation-origin')).toHaveTextContent(
            'Estado actual: Activa'
        );
        expect(
            screen.getByTestId('subscription-revocation-effect-authorization')
        ).toHaveTextContent('Se cancela su débito automático en Mercado Pago');
        expect(screen.getByTestId('subscription-revocation-effect-service')).toHaveTextContent(
            'Se corta el servicio ahora mismo'
        );
        const refund = screen.getByTestId('subscription-revocation-effect-refund');
        expect(refund).toHaveTextContent(/Se pide la devolución de \$\s?18\.000,00/);
        expect(screen.getByTestId('subscription-revocation-payment')).toHaveTextContent(
            'del cobro del 02/10/2026'
        );
        expect(screen.getByTestId('subscription-revocation-window')).toHaveTextContent(
            'hasta el 11/10/2026 inclusive'
        );
        expect(ready).not.toHaveTextContent('¿Estás seguro');
        expect(screen.getByTestId('subscription-revocation-confirm')).toBeEnabled();
    });

    it('(b) ready without an authorization says there is no debit to cancel', () => {
        // Arrange
        previewState.data = {
            ...READY,
            origin: 'PAUSED',
            effects: { ...READY.effects, cancelsAuthorization: false }
        };

        // Act
        renderScreen();

        // Assert
        expect(
            screen.getByTestId('subscription-revocation-effect-authorization')
        ).toHaveTextContent('No tiene débito automático en Mercado Pago');
        expect(screen.getByTestId('subscription-revocation-origin')).toHaveTextContent('Pausada');
        expect(screen.getByTestId('subscription-revocation-ready')).toHaveTextContent(
            'Se cierra la pausa.'
        );
    });

    it('(c) shows the predecessor line only when the charge belongs to another row', () => {
        // Arrange
        previewState.data = {
            ...READY,
            payment: { ...READY.payment, ownerSubscriptionId: PREDECESSOR_ID }
        };

        // Act
        const { unmount } = render(
            React.createElement(SubscriptionRevocationScreen, { subscriptionId: SUBSCRIPTION_ID })
        );

        // Assert
        expect(screen.getByTestId('subscription-revocation-predecessor')).toHaveTextContent(
            'suscripción anterior'
        );

        // Arrange + Act: same owner
        unmount();
        previewState.data = READY;
        renderScreen();

        // Assert
        expect(screen.queryByTestId('subscription-revocation-predecessor')).not.toBeInTheDocument();
    });

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

    it('(g) confirming sends the payment.id of the preview and the trimmed note', async () => {
        // Arrange
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.type(screen.getByTestId('subscription-revocation-note'), '  pidió por correo  ');
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID,
            note: 'pidió por correo'
        });
    });

    it('(g) without a note (or with only whitespace) the act gets no note', async () => {
        // Arrange
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.type(screen.getByTestId('subscription-revocation-note'), '   ');
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync.mock.calls[0]?.[0]).toStrictEqual({
            subscriptionId: SUBSCRIPTION_ID,
            expectedPaymentId: PAYMENT_ID
        });
    });

    it.each([
        'REVOCATION_PAYMENT_CHANGED',
        'REVOCATION_STATE_CHANGED'
    ] as const)('(h) a 409 %s leaves a notice and reads the preview again, without retrying', async (reason) => {
        // Arrange
        mutateAsync.mockRejectedValue(refusal(409, reason));
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        const notice = await screen.findByTestId('subscription-revocation-notice');
        expect(notice).toHaveTextContent(
            (esAdminBilling.subscriptionRevocation.notice as Record<string, string>)[reason] ??
                'MISSING'
        );
        expect(notice).toHaveTextContent('no se revocó nada');
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('subscription-revocation-result')).not.toBeInTheDocument();
    });

    it('(h) another known refusal of the act reads the preview again, without a notice or retry', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(refusal(422, 'REFUND_EXCEEDS_BALANCE'));
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledTimes(1);
        expect(addToast).not.toHaveBeenCalled();
    });

    it('(i) success shows the result with its cancelCall and no confirm button afterwards', async () => {
        // Arrange
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        const result = await screen.findByTestId('subscription-revocation-result');
        expect(result).toHaveTextContent('Suscripción revocada');
        expect(result).toHaveTextContent('pedido dddddddd-dddd-4ddd-8ddd-dddddddddddd');
        const cancelCall = screen.getByTestId('subscription-revocation-result-cancel-call');
        expect(cancelCall).toHaveAttribute('data-cancel-call', 'FAILED');
        expect(cancelCall).toHaveTextContent('igual quedó cancelada');
        expect(cancelCall).toHaveTextContent('el barrido reintenta');
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
        expectNoConfirm();
        expect(screen.queryByTestId('subscription-revocation-ready')).not.toBeInTheDocument();
    });

    it('(i) a 403 on the act reads as forbidden, with no confirm', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(refusal(403, 'ADMINISTRATIVE_ACTION_FORBIDDEN'));
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        expect(await screen.findByTestId('subscription-revocation-unavailable')).toHaveTextContent(
            'No podés revocar esta suscripción'
        );
        expectNoConfirm();
        expect(refetch).not.toHaveBeenCalled();
    });

    it('(i) an unexpected failure of the act shows an error toast', async () => {
        // Arrange
        mutateAsync.mockRejectedValue(refusal(500));
        const user = userEvent.setup();
        renderScreen();

        // Act
        await user.click(screen.getByTestId('subscription-revocation-confirm'));

        // Assert
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
        );
        expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    it('(j) an id that is not a uuid shows not found and never enables the preview', () => {
        // Arrange + Act
        renderScreen('not-a-uuid');

        // Assert
        expect(screen.getByTestId('subscription-revocation-unavailable')).toHaveTextContent(
            'Esta suscripción no existe.'
        );
        expect(previewInputs).toHaveBeenCalledWith({
            subscriptionId: 'not-a-uuid',
            enabled: false
        });
        expect(previewInputs).not.toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
        expectNoConfirm();
    });

    it('while loading shows the spinner and no confirm button', () => {
        // Arrange
        previewState.data = undefined;
        previewState.isLoading = true;

        // Act
        renderScreen();

        // Assert
        expect(screen.getByTestId('subscription-revocation-loading')).toBeInTheDocument();
        expectNoConfirm();
    });
});
