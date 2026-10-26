// @vitest-environment jsdom
import esAdminBilling from '@repo/i18n/locales/es/admin-billing.json';
import {
    type AdminSubscriptionCancellationPreviewResponse,
    type AdminSubscriptionCancellationResponse,
    PermissionEnum
} from '@repo/schemas';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { SubscriptionCancellationScreen } from '../SubscriptionCancellationScreen';

function translateEs(key: string, params?: Readonly<Record<string, unknown>>): string {
    let value: unknown = esAdminBilling;
    for (const segment of key.replace(/^admin-billing\./, '').split('.'))
        value =
            typeof value === 'object' && value !== null
                ? (value as Record<string, unknown>)[segment]
                : undefined;
    return typeof value === 'string'
        ? Object.entries(params ?? {}).reduce(
              (text, [name, item]) => text.replaceAll(`{${name}}`, String(item)),
              value
          )
        : key;
}
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));
const permissions = vi.fn<() => PermissionEnum[]>(() => []);
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => permissions() }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast }) }));
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PREVIEWS: Record<
    AdminSubscriptionCancellationPreviewResponse['origin'],
    AdminSubscriptionCancellationPreviewResponse
> = {
    ACTIVE: {
        subscriptionId: ID,
        vertical: 'accommodation',
        paymentMethod: 'CARD',
        origin: 'ACTIVE',
        serviceEndsAt: '2026-11-04T03:00:00.000Z',
        addons: [
            {
                addonInstanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                name: 'Promoción',
                price: 125000,
                currency: 'ARS',
                cycle: 'monthly',
                whenOff: 'CHARGE_CUT_TODAY'
            }
        ]
    },
    GRACE_PERIOD: {
        subscriptionId: ID,
        vertical: 'accommodation',
        paymentMethod: 'MANUAL',
        origin: 'GRACE_PERIOD',
        graceEndsAt: '2026-10-25T03:00:00.000Z',
        addons: []
    },
    SUSPENDED: {
        subscriptionId: ID,
        vertical: 'accommodation',
        paymentMethod: 'CARD',
        origin: 'SUSPENDED',
        addons: []
    },
    CANCEL_SCHEDULED: {
        subscriptionId: ID,
        vertical: 'accommodation',
        paymentMethod: 'MANUAL',
        origin: 'CANCEL_SCHEDULED',
        serviceEndsAt: '2026-11-04T03:00:00.000Z',
        addons: []
    }
};
const RESULT: AdminSubscriptionCancellationResponse = {
    subscriptionId: ID,
    outcome: 'CANCELLED',
    transition: 'S23',
    serviceEndsAt: '2026-10-18T03:00:00.000Z',
    cancelCall: 'SENT',
    escalated: 'NO_RECIPIENT'
};
const previewState: {
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    data: AdminSubscriptionCancellationPreviewResponse | undefined;
} = { isLoading: false, isFetching: false, error: null, data: PREVIEWS.ACTIVE };
const refetch = vi.fn();
const previewInputs = vi.fn();
const mutateAsync = vi.fn();
let mutationPending = false;
vi.mock('../../hooks/useSubscriptionCancellation', () => ({
    useSubscriptionCancellationPreview: (input: { subscriptionId: string; enabled: boolean }) => {
        previewInputs(input);
        return { ...previewState, refetch };
    },
    useCancelSubscriptionMutation: () => ({ mutateAsync, isPending: mutationPending })
}));
function refusal(status: number, reason?: string) {
    return new ApiError('refused', {
        status,
        body: { success: false, error: { code: 'X', message: 'refused', reason } }
    });
}
function renderScreen(id = ID) {
    render(React.createElement(SubscriptionCancellationScreen, { subscriptionId: id }));
}
function card() {
    return within(screen.getByTestId('subscription-cancellation-screen'));
}
function noConfirm() {
    expect(card().queryByTestId('subscription-cancellation-confirm')).not.toBeInTheDocument();
}
function setPreview(origin: AdminSubscriptionCancellationPreviewResponse['origin']) {
    previewState.data = PREVIEWS[origin];
    previewState.error = null;
    previewState.isLoading = false;
    previewState.isFetching = false;
}
beforeEach(() => {
    vi.clearAllMocks();
    setPreview('ACTIVE');
    mutateAsync.mockResolvedValue(RESULT);
    mutationPending = false;
    refetch.mockResolvedValue({});
    permissions.mockReturnValue([PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]);
});

describe('TEST:1696:3 AC:1696:3 cancellation screen', () => {
    it('requires BILLING_CANCEL_SUBSCRIPTION', () => {
        permissions.mockReturnValue([PermissionEnum.BILLING_SETTINGS_WRITE]);
        renderScreen();
        expect(screen.queryByTestId('subscription-cancellation-screen')).not.toBeInTheDocument();
    });
    it('ACTIVE shows the exact effect and confirm copy with this customer date and addon amount/cycle', () => {
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-effect-ACTIVE')).toHaveTextContent(
            'No se le vuelve a cobrar, y el servicio sigue hasta el 04/11/2026, el fin del período que ya pagó.'
        );
        expect(card().getByTestId('subscription-cancellation-confirm')).toHaveTextContent(
            'Dar de baja: cancelar el débito; el servicio sigue hasta el 04/11/2026'
        );
        expect(
            card().getByTestId('subscription-cancellation-addon-CHARGE_CUT_TODAY')
        ).toHaveTextContent(
            'Promoción: $ 1.250,00 por mes. Su cobro se corta hoy y lo sigue viendo hasta el 04/11/2026.'
        );
        expect(card().getByTestId('subscription-cancellation-authorization')).toHaveTextContent(
            'Si su débito automático'
        );
        expect(card().getByTestId('subscription-cancellation-no-refund')).toHaveTextContent(
            'Esta baja no devuelve plata.'
        );
    });
    it('GRACE_PERIOD shows its distinct exact effect and button with this customer date', () => {
        setPreview('GRACE_PERIOD');
        renderScreen();
        expect(
            card().getByTestId('subscription-cancellation-effect-GRACE_PERIOD')
        ).toHaveTextContent(
            'El servicio se corta hoy: pierde el servicio que el período de gracia le daba hasta el 25/10/2026. A cambio, no se le reclama la cuota que no se pudo cobrar.'
        );
        expect(card().getByTestId('subscription-cancellation-confirm')).toHaveTextContent(
            'Dar de baja: cortar el servicio hoy'
        );
        expect(card().getByTestId('subscription-cancellation-authorization')).toHaveTextContent(
            'Paga a mano'
        );
    });
    it('SUSPENDED shows its exact effect and confirm button', () => {
        setPreview('SUSPENDED');
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-effect-SUSPENDED')).toHaveTextContent(
            'La suscripción termina hoy. El servicio ya estaba cortado por la suspensión, y queda libre para volver a suscribirse.'
        );
        expect(card().getByTestId('subscription-cancellation-confirm')).toHaveTextContent(
            'Dar de baja: terminar la suscripción hoy'
        );
    });
    it('CANCEL_SCHEDULED shows its effects with customer date and no confirm inside card', () => {
        setPreview('CANCEL_SCHEDULED');
        renderScreen();
        expect(
            card().getByTestId('subscription-cancellation-effect-CANCEL_SCHEDULED')
        ).toHaveTextContent(
            'Ya tiene la baja pedida: el servicio sigue hasta el 04/11/2026. No hay nada que confirmar.'
        );
        noConfirm();
        expect(card().queryByTestId('subscription-cancellation-reason')).not.toBeInTheDocument();
    });
    it('TEST:1878:24b offers an optional reason and omits it from the mutation by default', async () => {
        const user = userEvent.setup();
        renderScreen();
        expect(card().getByText('Motivo de la baja (opcional)')).toBeInTheDocument();
        expect(mutateAsync).not.toHaveBeenCalled();
        await user.click(card().getByTestId('subscription-cancellation-confirm'));
        await waitFor(() =>
            expect(mutateAsync).toHaveBeenCalledWith({
                subscriptionId: ID,
                expectedOrigin: 'ACTIVE'
            })
        );
    });
    it('TEST:1878:24b sends a selected reason with the cancellation mutation', async () => {
        const user = userEvent.setup();
        renderScreen();
        await user.click(card().getByTestId('subscription-cancellation-reason'));
        await user.click(await screen.findByRole('option', { name: 'Pausa por temporada' }));
        await user.click(card().getByTestId('subscription-cancellation-confirm'));
        await waitFor(() =>
            expect(mutateAsync).toHaveBeenCalledWith({
                subscriptionId: ID,
                expectedOrigin: 'ACTIVE',
                reason: 'SEASONAL_PAUSE'
            })
        );
    });
    it('confirming disables the button and shows pending copy', () => {
        mutationPending = true;
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-confirm')).toBeDisabled();
        expect(card().getByTestId('subscription-cancellation-confirm')).toHaveTextContent(
            'Dando de baja…'
        );
    });
    it('a known preview origin conflict shows its notice copy and no confirm', () => {
        previewState.data = undefined;
        previewState.error = refusal(409, 'CANCELLATION_ORIGIN_CHANGED');
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-blocked')).toHaveTextContent(
            'La suscripción cambió desde que abriste esta pantalla'
        );
        noConfirm();
    });
    it('loading has no confirm', () => {
        previewState.data = undefined;
        previewState.isLoading = true;
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-loading')).toBeInTheDocument();
        noConfirm();
    });
    it('network and 5xx errors can retry but cannot confirm', () => {
        previewState.data = undefined;
        previewState.error = new ApiError('server', { status: 503 });
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-load-error')).toHaveTextContent(
            'No pudimos revisar la suscripción'
        );
        expect(card().getByText('Reintentar')).toBeInTheDocument();
        noConfirm();
    });
    it('known preview refusal blocks with exact copy and no confirm', () => {
        previewState.data = undefined;
        previewState.error = refusal(409, 'CANCELLATION_STATE_NOT_ALLOWED');
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-blocked')).toHaveTextContent(
            'La suscripción no está activa, en gracia, suspendida ni con baja programada'
        );
        noConfirm();
    });
    it('unknown preview refusal exposes the code and no confirm', () => {
        previewState.data = undefined;
        previewState.error = refusal(409, 'FUTURE_REASON');
        renderScreen();
        expect(card().getByTestId('subscription-cancellation-blocked')).toHaveTextContent(
            'FUTURE_REASON'
        );
        noConfirm();
    });
    it('409 CANCELLATION_ORIGIN_CHANGED leaves notice and requests a fresh preview', async () => {
        mutateAsync.mockRejectedValue(refusal(409, 'CANCELLATION_ORIGIN_CHANGED'));
        const user = userEvent.setup();
        renderScreen();
        await user.click(card().getByTestId('subscription-cancellation-confirm'));
        expect(await card().findByTestId('subscription-cancellation-notice')).toHaveTextContent(
            'La suscripción cambió desde que abriste esta pantalla'
        );
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
    it('a different known act rejection blocks without confirming again', async () => {
        mutateAsync.mockRejectedValue(refusal(409, 'CANCELLATION_STATE_NOT_ALLOWED'));
        const user = userEvent.setup();
        renderScreen();
        await user.click(card().getByTestId('subscription-cancellation-confirm'));
        expect(await card().findByTestId('subscription-cancellation-blocked')).toHaveTextContent(
            'La suscripción no está activa'
        );
        noConfirm();
    });
    it('success shows outcome, provider details, toast and no repeated confirm', async () => {
        const user = userEvent.setup();
        renderScreen();
        await user.click(card().getByTestId('subscription-cancellation-confirm'));
        const result = await card().findByTestId('subscription-cancellation-result');
        expect(result).toHaveTextContent('sin servicio desde el 18/10/2026');
        expect(
            card().getByTestId('subscription-cancellation-result-cancel-call')
        ).toHaveTextContent('se mandó la cancelación del débito');
        expect(card().getByTestId('subscription-cancellation-result-escalated')).toHaveTextContent(
            'se canceló igual y quedó escalado'
        );
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
        noConfirm();
    });
    it('invalid id does not enable the preview', () => {
        renderScreen('not-a-uuid');
        expect(card().getByTestId('subscription-cancellation-blocked')).toBeInTheDocument();
        expect(previewInputs).toHaveBeenCalledWith({
            subscriptionId: 'not-a-uuid',
            enabled: false
        });
        noConfirm();
    });
});
