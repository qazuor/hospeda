// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum, type SubscriptionRevocationResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { RevocationRefundSettlement } from '../RevocationRefundSettlement';
import { RevocationResultDetails } from '../RevocationResultDetails';

const state = vi.hoisted(() => ({ permissions: [] as PermissionEnum[], fetchApi: vi.fn() }));
type TranslationTree = string | { readonly [key: string]: TranslationTree };
const readTranslation = (root: TranslationTree, path: string): TranslationTree | undefined =>
    path
        .split('.')
        .reduce<TranslationTree | undefined>(
            (node, part) => (typeof node === 'string' ? undefined : node[part]),
            root
        );
vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: PermissionEnum) => state.permissions.includes(permission)
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, values?: Record<string, string>) => {
            const value = readTranslation(es, key.replace(/^admin-billing\./, ''));
            return typeof value === 'string'
                ? value.replace(
                      /\{\{?(\w+)\}?\}/g,
                      (_m, name: string) => values?.[name] ?? `{{${name}}}`
                  )
                : key;
        }
    })
}));
vi.mock('@/lib/api/client', () => ({ fetchApi: state.fetchApi }));

const PAYMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REFUND_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESULT: SubscriptionRevocationResponse = {
    subscriptionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'CANCELLED',
    origin: 'ACTIVE',
    serviceEndedAt: '2026-10-05T15:00:00.000Z',
    refundId: REFUND_ID,
    refundAmount: 1800000,
    payment: { source: 'PAYMENT', id: PAYMENT_ID },
    cancelCall: 'NOT_NEEDED'
};
const MANUAL = { ...RESULT, payment: { source: 'MANUAL_PAYMENT' as const, id: PAYMENT_ID } };
const copy = (path: string) => readTranslation(es.subscriptionRevocation, path);
const renderSettlement = (result = RESULT) => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <RevocationRefundSettlement result={result} />
        </QueryClientProvider>
    );
};
const section = () => within(screen.getByTestId('subscription-revocation-settlement'));
const setReference = (value = 'mp-refund-1') =>
    fireEvent.change(section().getByLabelText('Comprobante o referencia'), { target: { value } });
const review = () => fireEvent.click(section().getByRole('button', { name: 'Revisar asiento' }));
const settle = () => fireEvent.click(section().getByRole('button', { name: 'Asentar ahora' }));
const response = (closedRequestedRefund = true, refundId = REFUND_ID) => ({
    data: {
        data: {
            refundId,
            status: 'EXECUTED',
            closedRequestedRefund,
            paymentOutcome: 'P3',
            coverageReleased: true
        }
    },
    status: 200
});

describe('TEST:1711:1 AC:1711:1 permission and prefilled settlement', () => {
    beforeEach(() => {
        state.permissions = [];
        state.fetchApi.mockReset();
    });
    it('TEST:1711:1 AC:1711:1 offers the prefilled form only with the settlement permission', () => {
        state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
        renderSettlement();
        expect(screen.getByTestId('subscription-revocation-settlement')).toBeInTheDocument();
        expect(section().getByLabelText('Monto en pesos')).toHaveValue(18000);
        expect(section().getByLabelText('Canal de devolución')).toHaveValue('PROVIDER_PANEL');
    });
    it('TEST:1711:1 AC:1711:1 explains that another operator records it when permission is absent', () => {
        state.permissions = [
            PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ];
        renderSettlement();
        const forbidden = screen.getByTestId('subscription-revocation-settlement-forbidden');
        expect(forbidden).toHaveTextContent(copy('settlement.noPermission'));
        expect(screen.queryByLabelText('Comprobante o referencia')).not.toBeInTheDocument();
        expect(state.fetchApi).not.toHaveBeenCalled();
    });
});

describe('TEST:1711:2 AC:1711:2 exact request body and result', () => {
    beforeEach(() => {
        state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
        state.fetchApi.mockReset();
    });
    it('TEST:1711:2 AC:1711:2 closes the requested payment refund and shows the success result', async () => {
        state.fetchApi.mockResolvedValue(response());
        renderSettlement();
        setReference();
        fireEvent.change(section().getByLabelText('Nota opcional'), {
            target: { value: 'pedido 42' }
        });
        review();
        expect(state.fetchApi).not.toHaveBeenCalled();
        settle();
        await waitFor(() =>
            expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
                path: '/api/v1/admin/billing-refunds/external',
                method: 'POST',
                body: {
                    paymentId: PAYMENT_ID,
                    amount: 1800000,
                    channel: 'PROVIDER_PANEL',
                    reference: 'mp-refund-1',
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: REFUND_ID,
                    note: 'pedido 42'
                }
            })
        );
        expect(await screen.findByRole('status')).toHaveTextContent(
            copy('settlement.success.closed')
                .replace('{{refundId}}', REFUND_ID)
                .replace('{{status}}', 'EXECUTED')
        );
        expect(
            section().queryByRole('button', { name: 'Revisar asiento' })
        ).not.toBeInTheDocument();
    });
    it('TEST:1711:2 AC:1711:2 uses manual payment fields and omits an empty note', async () => {
        state.fetchApi.mockResolvedValue(response());
        renderSettlement(MANUAL);
        setReference('transfer-1');
        review();
        settle();
        await waitFor(() =>
            expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
                path: '/api/v1/admin/billing-refunds/external',
                method: 'POST',
                body: {
                    manualPaymentId: PAYMENT_ID,
                    manualPaymentScope: 'TOTAL',
                    amount: 1800000,
                    channel: 'BANK_TRANSFER',
                    reference: 'transfer-1',
                    reason: 'MANUAL_PAYMENT_REFUND',
                    refundId: REFUND_ID
                }
            })
        );
    });
});

describe('TEST:1711:3 AC:1711:3 requested amount choice', () => {
    beforeEach(() => {
        state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
        state.fetchApi.mockReset();
    });
    it('TEST:1711:3 AC:1711:3 requires choosing to close by the settled amount', async () => {
        state.fetchApi.mockResolvedValue(response());
        renderSettlement();
        fireEvent.change(section().getByLabelText('Monto en pesos'), {
            target: { value: '17000.00' }
        });
        setReference();
        review();
        expect(
            section().getByText(
                copy('settlement.mismatch.notice')
                    .replace('{{amount}}', '17000.00')
                    .replace('{{requested}}', '18000.00')
            )
        ).toBeInTheDocument();
        expect(section().getByRole('button', { name: 'Asentar ahora' })).toBeDisabled();
        fireEvent.click(
            section().getByLabelText(copy('settlement.mismatch.CLOSE_WITH_SETTLED_AMOUNT'))
        );
        settle();
        await waitFor(() =>
            expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
                path: '/api/v1/admin/billing-refunds/external',
                method: 'POST',
                body: {
                    paymentId: PAYMENT_ID,
                    amount: 1700000,
                    channel: 'PROVIDER_PANEL',
                    reference: 'mp-refund-1',
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: REFUND_ID,
                    onAmountMismatch: 'CLOSE_WITH_SETTLED_AMOUNT'
                }
            })
        );
    });
    it('TEST:1711:3 AC:1711:3 settles separately and describes the still-open request', async () => {
        const otherId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
        state.fetchApi.mockResolvedValue(response(false, otherId));
        renderSettlement();
        fireEvent.change(section().getByLabelText('Monto en pesos'), {
            target: { value: '17000.00' }
        });
        setReference();
        review();
        fireEvent.click(section().getByLabelText(copy('settlement.mismatch.SETTLE_SEPARATELY')));
        settle();
        await waitFor(() =>
            expect(state.fetchApi.mock.calls[0]?.[0].body).toEqual({
                paymentId: PAYMENT_ID,
                amount: 1700000,
                channel: 'PROVIDER_PANEL',
                reference: 'mp-refund-1',
                reason: 'OUT_OF_FLOW_REFUND',
                refundId: REFUND_ID,
                onAmountMismatch: 'SETTLE_SEPARATELY'
            })
        );
        expect(await screen.findByRole('status')).toHaveTextContent(
            copy('settlement.success.separate')
                .replace('{{refundId}}', otherId)
                .replace('{{status}}', 'EXECUTED')
                .replace('{{requestedRefundId}}', REFUND_ID)
        );
    });
    it('TEST:1711:3 AC:1711:3 omits mismatch for an equal amount and clears choice on back', async () => {
        state.fetchApi.mockResolvedValue(response());
        renderSettlement();
        fireEvent.change(section().getByLabelText('Monto en pesos'), {
            target: { value: '17000.00' }
        });
        setReference();
        review();
        fireEvent.click(section().getByLabelText(copy('settlement.mismatch.SETTLE_SEPARATELY')));
        fireEvent.click(section().getByRole('button', { name: 'Volver al formulario' }));
        fireEvent.change(section().getByLabelText('Monto en pesos'), {
            target: { value: '18000.00' }
        });
        review();
        settle();
        await waitFor(() =>
            expect(state.fetchApi.mock.calls[0]?.[0]).toEqual({
                path: '/api/v1/admin/billing-refunds/external',
                method: 'POST',
                body: {
                    paymentId: PAYMENT_ID,
                    amount: 1800000,
                    channel: 'PROVIDER_PANEL',
                    reference: 'mp-refund-1',
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: REFUND_ID
                }
            })
        );
    });
});

describe('TEST:1711:4 AC:1711:4 rejection messages', () => {
    beforeEach(() => {
        state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
        state.fetchApi.mockReset();
    });
    it.each([
        [409, 'REQUESTED_AMOUNT_MISMATCH', 'action14.rejections.REQUESTED_AMOUNT_MISMATCH'],
        [409, 'REFUND_NOT_OPEN', 'action14.rejections.REFUND_NOT_OPEN'],
        [500, 'SERVER', 'action14.serverError'],
        [409, 'NEW_UNKNOWN_REASON', 'action14.genericError']
    ])('TEST:1711:4 AC:1711:4 shows the right message for %s %s', async (status, reason, path) => {
        state.fetchApi.mockRejectedValue(
            new ApiError('failed', { status: Number(status), body: { error: { reason } } })
        );
        renderSettlement();
        setReference();
        review();
        settle();
        const alert = await screen.findByRole('alert');
        const translated = path
            .split('.')
            .reduce<TranslationTree | undefined>(
                (value, part) => (typeof value === 'string' ? undefined : value[part]),
                es.reconciliationMarks
            );
        expect(alert).toHaveTextContent(translated);
        expect(section().getByRole('button', { name: 'Revisar asiento' })).toBeInTheDocument();
        expect(state.fetchApi).toHaveBeenCalledTimes(1);
    });
});

describe('TEST:1711:6 AC:1711:1 result integration', () => {
    it('TEST:1711:6 AC:1711:1 mounts the settlement form in the revocation result', () => {
        state.permissions = [PermissionEnum.BILLING_SETTLE_EXTERNAL];
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <RevocationResultDetails
                    result={RESULT}
                    currency="ARS"
                />
            </QueryClientProvider>
        );
        const result = within(screen.getByTestId('subscription-revocation-result'));
        expect(result.getByTestId('subscription-revocation-settlement')).toBeInTheDocument();
        expect(
            within(result.getByTestId('subscription-revocation-settlement')).getByLabelText(
                'Monto en pesos'
            )
        ).toHaveValue(18000);
        expect(
            result.getByText(copy('settlement.intro').replace('{{refundId}}', REFUND_ID))
        ).toBeInTheDocument();
    });
});
