// @vitest-environment jsdom
/** Tests for the permission gated, explicit action 7 confirmation. */

import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { LiftReconciliationMarkAction } from '../LiftReconciliationMarkAction';

const state = vi.hoisted(() => ({
    permissions: ['billing.subscription.inspect'] as string[],
    mutateAsync: vi.fn()
}));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => state.permissions }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string) =>
            key
                .split('.')
                .slice(1)
                .reduce((obj: any, part) => obj?.[part], es)
    })
}));
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));
vi.mock('../../hooks/useLiftReconciliationMark', () => ({
    useLiftReconciliationMarkMutation: () => ({ mutateAsync: state.mutateAsync, isPending: false })
}));

const paymentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const resolvedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const mark = {
    markId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    version: 7,
    reason: 'PAGO_TARDIO_RECHAZADO',
    reasonNumber: 7,
    refundConfirmation: true,
    defaultProposal: 'REFUND' as const,
    openedAt: '2026-10-18T12:00:00.000Z',
    subject: {
        kind: 'SUBSCRIPTION' as const,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'ACTIVE'
    },
    payments: [
        {
            source: 'PAYMENT' as const,
            paymentId,
            amountMinor: 12500,
            currency: 'ARS',
            status: 'SUCCEEDED',
            hungAt: '2026-10-17T12:00:00.000Z',
            resolvedAt: null
        },
        {
            source: 'MANUAL_PAYMENT' as const,
            paymentId: resolvedId,
            amountMinor: 8000,
            currency: 'ARS',
            status: 'SETTLED',
            hungAt: '2026-10-16T12:00:00.000Z',
            resolvedAt: '2026-10-18T12:00:00.000Z'
        }
    ],
    paymentCount: 2,
    totalAmount: [{ currency: 'ARS', amountMinor: 20500 }],
    unknownAmountCount: 0,
    eventLink: null
};

function renderAction() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    return {
        invalidate,
        ...render(
            <QueryClientProvider client={queryClient}>
                <article data-testid="reconciliation-mark">
                    <p data-testid="mark-neighbor">Marca visible</p>
                    <LiftReconciliationMarkAction
                        mark={mark}
                        locale="es"
                    />
                </article>
            </QueryClientProvider>
        )
    };
}

function tr(path: string) {
    return path
        .split('.')
        .slice(1)
        .reduce((obj: any, key) => obj?.[key], es);
}

beforeEach(() => {
    state.permissions = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
    state.mutateAsync.mockReset().mockResolvedValue({});
});

describe('TEST:1697:13 AC:1697:5 lift action', () => {
    it('hides the button without its permission while the neighbor remains visible', () => {
        state.permissions = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        const article = renderAction();
        expect(
            within(screen.getByTestId('reconciliation-mark')).getByTestId('mark-neighbor')
        ).toBeInTheDocument();
        expect(article.getByTestId('reconciliation-mark')).toBeInTheDocument();
        expect(screen.queryByTestId('reconciliation-mark-lift')).not.toBeInTheDocument();
    });

    it('opens the confirmation with the mark reason and system proposal', () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        const dialog = screen.getByTestId('reconciliation-mark-lift-dialog');
        expect(within(dialog).getByText('7 · PAGO_TARDIO_RECHAZADO')).toBeInTheDocument();
        expect(
            within(dialog).getByText(
                `${tr('admin-billing.reconciliationMarks.proposal')}: ${tr('admin-billing.reconciliationMarks.proposals.refund')}`
            )
        ).toBeInTheDocument();
        expect(
            within(dialog).getByText(
                (_, element) =>
                    element?.tagName === 'P' &&
                    element.textContent?.includes(tr('admin-billing.reconciliationMarks.total')) ===
                        true
            )
        ).toBeInTheDocument();
    });

    it('shows unresolved payments unchecked and resolved payments without a checkbox', () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        const checkboxes = screen.getAllByTestId('reconciliation-mark-lift-without-refund');
        expect(checkboxes).toHaveLength(1);
        expect(checkboxes[0]).not.toBeChecked();
        expect(screen.getByText(new RegExp(paymentId))).toBeInTheDocument();
        expect(screen.queryByText(new RegExp(resolvedId))).not.toBeInTheDocument();
    });

    it('confirms an empty resolution list against the version the person saw', async () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-confirm'));
        await waitFor(() =>
            expect(state.mutateAsync).toHaveBeenCalledWith({
                markId: mark.markId,
                expectedVersion: 7,
                resolveWithoutRefund: []
            })
        );
    });

    it('sends only the payment the person marked', async () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-without-refund'));
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-confirm'));
        await waitFor(() =>
            expect(state.mutateAsync).toHaveBeenCalledWith({
                markId: mark.markId,
                expectedVersion: 7,
                resolveWithoutRefund: [{ source: 'PAYMENT', paymentId }]
            })
        );
    });

    it('shows a known reason from es in an alert and uses generic copy for an unknown reason', async () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        state.mutateAsync.mockRejectedValueOnce(
            new ApiError('Conflict', {
                status: 409,
                body: { error: { reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' } }
            })
        );
        const view = renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-confirm'));
        expect(await screen.findByTestId('reconciliation-mark-lift-error')).toHaveTextContent(
            tr('admin-billing.reconciliationMarks.lift.reasons.MARK_HAS_UNRESOLVED_PAYMENTS')
        );
        view.unmount();
        renderAction();
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        state.mutateAsync.mockRejectedValueOnce(
            new ApiError('Conflict', {
                status: 409,
                body: { error: { reason: 'SOME_FUTURE_REASON' } }
            })
        );
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-confirm'));
        expect(await screen.findByTestId('reconciliation-mark-lift-error')).toHaveTextContent(
            tr('admin-billing.reconciliationMarks.lift.error')
        );
    });

    it('invalidates the list after a version conflict', async () => {
        state.permissions = [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK];
        const view = renderAction();
        state.mutateAsync.mockRejectedValueOnce(
            new ApiError('Conflict', {
                status: 409,
                body: { error: { reason: 'MARK_VERSION_CONFLICT' } }
            })
        );
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift'));
        fireEvent.click(screen.getByTestId('reconciliation-mark-lift-confirm'));
        expect(await screen.findByTestId('reconciliation-mark-lift-error')).toHaveTextContent(
            tr('admin-billing.reconciliationMarks.lift.reasons.MARK_VERSION_CONFLICT')
        );
        await waitFor(() =>
            expect(view.invalidate).toHaveBeenCalledWith({
                queryKey: ['billing-reconciliation', 'marks']
            })
        );
    });
});
