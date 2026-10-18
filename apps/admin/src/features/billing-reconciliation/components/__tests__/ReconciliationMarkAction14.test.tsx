// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { ReconciliationMarkAction14 } from '../ReconciliationMarkAction14';

const state = vi.hoisted(() => ({ permissions: [] as string[], fetchApi: vi.fn() }));
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: () => state.permissions.includes('billing.settleExternal')
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, values?: Record<string, string>) => {
            const text = key
                .split('.')
                .slice(1)
                .reduce((item: any, part) => item?.[part], es);
            return typeof text === 'string'
                ? text.replace(
                      /\{\{(\w+)\}\}/g,
                      (_match, name: string) => values?.[name] ?? `{{${name}}}`
                  )
                : key;
        }
    })
}));
vi.mock('@/lib/api/client', () => ({ fetchApi: state.fetchApi }));

const paymentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mark = (reason: string, source: 'PAYMENT' | 'MANUAL_PAYMENT' = 'PAYMENT') => ({
    markId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reason,
    reasonNumber: reason === 'REEMBOLSO_FUERA_DEL_FLUJO' ? 18 : 19,
    refundConfirmation: false,
    defaultProposal: 'NONE' as const,
    openedAt: '2026-01-01T00:00:00.000Z',
    subject: {
        kind: 'SUBSCRIPTION' as const,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'ACTIVE'
    },
    payments:
        reason === 'REEMBOLSO_FUERA_DEL_FLUJO'
            ? [
                  {
                      source,
                      paymentId,
                      amountMinor: 12550,
                      currency: 'ARS',
                      status: 'SUCCEEDED',
                      hungAt: '2026-01-01T00:00:00.000Z',
                      resolvedAt: null
                  }
              ]
            : [],
    paymentCount: 1,
    totalAmount: [{ currency: 'ARS', amountMinor: 12550 }],
    unknownAmountCount: 0,
    eventLink: null
});
const renderAction = (value: ReturnType<typeof mark>) => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ReconciliationMarkAction14 mark={value} />
        </QueryClientProvider>
    );
};
const permit = () => {
    state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
};

describe('TEST:1621:6 action 14 from reconciliation marks', () => {
    beforeEach(() => {
        state.permissions = [];
        state.fetchApi.mockReset();
    });

    it('a) preselects the hung provider payment for mark 18', () => {
        permit();
        renderAction(mark('REEMBOLSO_FUERA_DEL_FLUJO'));
        expect(screen.getByTestId('reconciliation-mark-action14')).toHaveAttribute(
            'data-reason',
            'REEMBOLSO_FUERA_DEL_FLUJO'
        );
        expect(screen.getByText(`Pago colgado: ${paymentId}`)).toBeInTheDocument();
        expect(screen.getByLabelText('Monto en pesos')).toHaveValue(125.5);
    });

    it('b) hides the action without its route permission', () => {
        const { container } = renderAction(mark('REEMBOLSO_FUERA_DEL_FLUJO'));
        expect(container).toBeEmptyDOMElement();
    });

    it('c) offers nothing for mark 7', () => {
        permit();
        const { container } = renderAction({ ...mark('PAGO_TARDIO_RECHAZADO'), reasonNumber: 7 });
        expect(container).toBeEmptyDOMElement();
    });

    it('d) describes the settlement and makes no request before confirmation', async () => {
        permit();
        state.fetchApi.mockResolvedValue({
            data: { data: { refundId: paymentId, status: 'EXECUTED' } },
            status: 200
        });
        renderAction(mark('REEMBOLSO_FUERA_DEL_FLUJO'));
        fireEvent.change(screen.getByLabelText('Comprobante o referencia'), {
            target: { value: 'receipt-1621' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        expect(screen.getByTestId('reconciliation-mark-action14-confirmation')).toHaveTextContent(
            'Se va a registrar una devolución de 125.50 ya hecha por transferencia bancaria, con el comprobante receipt-1621. Queda a tu nombre y no se devuelve plata.'
        );
        expect(state.fetchApi).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        await waitFor(() => expect(state.fetchApi).toHaveBeenCalledTimes(1));
    });

    it('e) posts exact provider and manual refund bodies in integer cents', async () => {
        permit();
        state.fetchApi.mockResolvedValue({
            data: { data: { refundId: paymentId, status: 'EXECUTED' } },
            status: 200
        });
        const first = renderAction(mark('REEMBOLSO_FUERA_DEL_FLUJO'));
        fireEvent.change(screen.getByLabelText('Monto en pesos'), { target: { value: '12.34' } });
        fireEvent.change(screen.getByLabelText('Comprobante o referencia'), {
            target: { value: 'bank-ref' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        await waitFor(() => expect(state.fetchApi).toHaveBeenCalledTimes(1));
        expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
            path: '/api/v1/admin/billing-refunds/external',
            method: 'POST',
            body: {
                paymentId,
                amount: 1234,
                channel: 'BANK_TRANSFER',
                reference: 'bank-ref',
                reason: 'OUT_OF_FLOW_REFUND'
            }
        });
        first.unmount();
        state.fetchApi.mockClear();

        renderAction(mark('REEMBOLSO_FUERA_DEL_FLUJO', 'MANUAL_PAYMENT'));
        fireEvent.change(screen.getByLabelText('Monto en pesos'), { target: { value: '12.34' } });
        fireEvent.change(screen.getByLabelText('Comprobante o referencia'), {
            target: { value: 'manual-ref' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        await waitFor(() => expect(state.fetchApi).toHaveBeenCalledTimes(1));
        expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
            path: '/api/v1/admin/billing-refunds/external',
            method: 'POST',
            body: {
                manualPaymentId: paymentId,
                manualPaymentScope: 'TOTAL',
                amount: 1234,
                channel: 'BANK_TRANSFER',
                reference: 'manual-ref',
                reason: 'MANUAL_PAYMENT_REFUND'
            }
        });
    });

    it('f) posts the charge id and note to the external-charge route', async () => {
        permit();
        state.fetchApi.mockResolvedValue({
            data: {
                data: {
                    paymentId,
                    paymentStatus: 'SUCCEEDED',
                    coverage: 'WRITTEN',
                    reception: 'P1'
                }
            },
            status: 200
        });
        renderAction(mark('COBRO_SIN_REGISTRAR'));
        fireEvent.change(screen.getByLabelText('ID del cobro aprobado en el proveedor'), {
            target: { value: 'charge-19' }
        });
        fireEvent.change(screen.getByLabelText('Nota opcional'), { target: { value: 'checked' } });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        expect(screen.getByTestId('reconciliation-mark-action14-confirmation')).toHaveTextContent(
            'Se va a registrar el cobro charge-19 que el proveedor ya aprobó y correr la regla que lo recibe. Queda a tu nombre.'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        await waitFor(() => expect(state.fetchApi).toHaveBeenCalledTimes(1));
        expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
            path: '/api/v1/admin/billing-refunds/external-charge',
            method: 'POST',
            body: { chargeId: 'charge-19', note: 'checked' }
        });
    });

    it('g) translates a known conflict and uses the generic text for an unknown reason', async () => {
        permit();
        state.fetchApi.mockRejectedValueOnce(
            new ApiError('Conflict', {
                status: 409,
                body: { error: { reason: 'CHARGE_ALREADY_RECORDED' } }
            })
        );
        renderAction(mark('COBRO_SIN_REGISTRAR'));
        fireEvent.change(screen.getByLabelText('ID del cobro aprobado en el proveedor'), {
            target: { value: 'charge-19' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Ese cobro ya está registrado.');
        state.fetchApi.mockRejectedValueOnce(
            new ApiError('Conflict', {
                status: 409,
                body: { error: { reason: 'NEW_UNKNOWN_REASON' } }
            })
        );
        fireEvent.click(screen.getByRole('button', { name: 'Revisar asiento' }));
        fireEvent.click(screen.getByRole('button', { name: 'Asentar ahora' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No se pudo asentar la acción. Revisá los datos e intentá de nuevo.'
        );
    });
});
