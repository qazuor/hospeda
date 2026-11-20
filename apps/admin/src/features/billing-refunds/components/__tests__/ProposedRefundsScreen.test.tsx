// @vitest-environment jsdom
/** Tests for the proposed-refund list and its confirm and decline actions (action 13). */

import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum, type ProposedRefund } from '@repo/schemas';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { ProposedRefundsScreen } from '../ProposedRefundsScreen';

const state = vi.hoisted(() => ({
    permissions: ['billing.refund'] as string[],
    list: {
        isLoading: false,
        isError: false,
        data: undefined as unknown,
        refetch: vi.fn()
    },
    confirm: vi.fn(),
    decline: vi.fn(),
    addToast: vi.fn(),
    pages: [] as number[]
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: string) => state.permissions.includes(permission)
}));
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
    useToast: () => ({ addToast: state.addToast })
}));
vi.mock('../../hooks/useProposedRefunds', () => ({
    useProposedRefunds: ({ page }: { page: number }) => {
        state.pages.push(page);
        return state.list;
    }
}));
vi.mock('../../hooks/useRefundDecision', () => ({
    useConfirmRefundMutation: () => ({ mutateAsync: state.confirm, isPending: false }),
    useDeclineRefundMutation: () => ({ mutateAsync: state.decline, isPending: false })
}));

const REFUND_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MARK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function refundWith(overrides: Partial<ProposedRefund> = {}): ProposedRefund {
    return {
        refundId: REFUND_ID,
        status: 'REQUESTED',
        amountMinor: 12500,
        currency: 'ARS',
        requestedAt: '2026-11-18T12:00:00.000Z',
        payment: { source: 'PAYMENT', id: PAYMENT_ID },
        providerCallCount: 0,
        closesHeldCharge: false,
        marks: [
            {
                markId: MARK_ID,
                reason: 'COBRO_DUPLICADO',
                reasonNumber: 20,
                openedAt: '2026-11-17T12:00:00.000Z',
                liftedAt: null,
                subject: { kind: 'ADDON_INSTANCE', id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }
            }
        ],
        ...overrides
    };
}

function listOf(...items: ProposedRefund[]) {
    state.list.data = {
        items,
        pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 }
    };
}

function tr(path: string): string {
    return path
        .split('.')
        .slice(1)
        .reduce((obj: any, key) => obj?.[key], es);
}

function conflict(reason: string) {
    return new ApiError('Conflict', { status: 409, body: { error: { reason } } });
}

beforeEach(() => {
    state.permissions = [PermissionEnum.BILLING_REFUND];
    state.list.isLoading = false;
    state.list.isError = false;
    state.confirm.mockReset().mockResolvedValue({
        refundId: REFUND_ID,
        status: 'CONFIRMED',
        outcome: 'SENT',
        calls: []
    });
    state.decline.mockReset().mockResolvedValue({ refundId: REFUND_ID, status: 'FAILED' });
    state.addToast.mockReset();
    state.pages.length = 0;
    listOf(refundWith());
});

describe('HOS-2400 proposed refunds list', () => {
    it('renders each refund with its amount, status and originating mark', () => {
        // Arrange + Act
        render(<ProposedRefundsScreen />);

        // Assert
        const article = screen.getByTestId('proposed-refund');
        expect(article).toHaveAttribute('data-refund-id', REFUND_ID);
        expect(within(article).getByTestId('proposed-refund-amount')).toHaveTextContent(/125/);
        expect(within(article).getByTestId('proposed-refund-status')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.statuses.REQUESTED')
        );
        const mark = within(article).getByTestId('proposed-refund-mark');
        expect(mark).toHaveAttribute('data-mark-id', MARK_ID);
        expect(mark).toHaveTextContent(
            `20 · ${tr('admin-billing.reconciliationMarks.reasons.COBRO_DUPLICADO')}`
        );
    });

    it('says so when no mark is attached to the payment', () => {
        listOf(refundWith({ marks: [] }));
        render(<ProposedRefundsScreen />);
        expect(screen.getByTestId('proposed-refund-no-mark')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.noMark')
        );
    });

    it('shows the empty state', () => {
        listOf();
        render(<ProposedRefundsScreen />);
        expect(screen.getByTestId('proposed-refunds-empty')).toBeInTheDocument();
        expect(screen.queryByTestId('proposed-refund')).not.toBeInTheDocument();
    });

    it('renders nothing for a person without the refund permission', () => {
        state.permissions = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        render(<ProposedRefundsScreen />);
        expect(screen.queryByTestId('proposed-refund')).not.toBeInTheDocument();
    });
});

describe('HOS-2400 confirm (action 13)', () => {
    it('sends nothing until the dialog is confirmed, then confirms that refund', async () => {
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-confirm'));
        expect(state.confirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('proposed-refund-confirm-submit'));

        await waitFor(() => expect(state.confirm).toHaveBeenCalledWith({ refundId: REFUND_ID }));
        expect(state.addToast).toHaveBeenCalledWith({
            message: tr('admin-billing.proposedRefunds.confirm.success'),
            variant: 'success'
        });
    });

    it('warns instead of celebrating when the provider did not accept it', async () => {
        state.confirm.mockResolvedValueOnce({
            refundId: REFUND_ID,
            status: 'CONFIRMED',
            outcome: 'NOT_ACCEPTED_KEPT_CONFIRMED',
            calls: []
        });
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-confirm'));
        fireEvent.click(screen.getByTestId('proposed-refund-confirm-submit'));

        await waitFor(() =>
            expect(state.addToast).toHaveBeenCalledWith({
                message: tr(
                    'admin-billing.proposedRefunds.confirm.outcomes.NOT_ACCEPTED_KEPT_CONFIRMED'
                ),
                variant: 'warning'
            })
        );
    });

    it('shows the typed refusal inside the dialog', async () => {
        state.confirm.mockRejectedValueOnce(conflict('REFUND_PAST_PROVIDER_WINDOW'));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-confirm'));
        fireEvent.click(screen.getByTestId('proposed-refund-confirm-submit'));

        expect(await screen.findByTestId('proposed-refund-error')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.rejections.REFUND_PAST_PROVIDER_WINDOW')
        );
    });
});

describe('HOS-2400 decline (action 13 refusal)', () => {
    it('declines a REQUESTED refund after the explicit confirmation, with no MP warning', async () => {
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));
        expect(screen.queryByTestId('proposed-refund-confirmed-warning')).not.toBeInTheDocument();
        expect(state.decline).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('proposed-refund-decline-submit'));

        await waitFor(() => expect(state.decline).toHaveBeenCalledWith({ refundId: REFUND_ID }));
        expect(state.addToast).toHaveBeenCalledWith({
            message: tr('admin-billing.proposedRefunds.decline.success'),
            variant: 'success'
        });
    });

    it('warns to check the MP panel before declining a CONFIRMED refund with zero calls', () => {
        listOf(refundWith({ status: 'CONFIRMED' }));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));

        const warning = screen.getByTestId('proposed-refund-confirmed-warning');
        expect(warning).toHaveTextContent(
            'verificá en el panel de MP que no salió ninguna devolución antes de rechazar'
        );
        expect(state.decline).not.toHaveBeenCalled();
    });

    it('keeps the verify-in-MP warning visible after declining a CONFIRMED refund', async () => {
        listOf(refundWith({ status: 'CONFIRMED' }));
        state.decline.mockResolvedValueOnce({
            refundId: REFUND_ID,
            status: 'FAILED',
            warning: 'VERIFY_NO_PROVIDER_REFUND'
        });
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));
        fireEvent.click(screen.getByTestId('proposed-refund-decline-submit'));

        await waitFor(() =>
            expect(state.addToast).toHaveBeenCalledWith({
                message: tr('admin-billing.proposedRefunds.decline.successVerify'),
                variant: 'warning'
            })
        );
    });

    it('lets a CONFIRMED refund of a held charge be declined (call-less, owner option 1)', () => {
        listOf(refundWith({ status: 'CONFIRMED', closesHeldCharge: false }));
        render(<ProposedRefundsScreen />);

        expect(screen.getByTestId('proposed-refund-decline')).toBeEnabled();
        expect(screen.queryByTestId('proposed-refund-decline-locked')).not.toBeInTheDocument();
    });

    it('locks the button and explains it when the server answers REFUND_CLOSES_HELD_CHARGE', async () => {
        state.decline.mockRejectedValueOnce(conflict('REFUND_CLOSES_HELD_CHARGE'));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));
        fireEvent.click(screen.getByTestId('proposed-refund-decline-submit'));

        await waitFor(() => expect(screen.getByTestId('proposed-refund-decline')).toBeDisabled());
        expect(screen.getByTestId('proposed-refund-decline-locked')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.decline.closesHeldCharge')
        );
        expect(state.addToast).not.toHaveBeenCalled();
    });

    it('starts locked, with the explanation, for the refund of a held charge', () => {
        listOf(refundWith({ closesHeldCharge: true }));
        render(<ProposedRefundsScreen />);

        expect(screen.getByTestId('proposed-refund-decline')).toBeDisabled();
        expect(screen.getByTestId('proposed-refund-decline-locked')).toBeInTheDocument();
        expect(screen.getByTestId('proposed-refund-confirm')).toBeEnabled();
    });

    it('keeps the dialog open with the typed refusal for any other 409', async () => {
        state.decline.mockRejectedValueOnce(conflict('REFUND_HAS_PROVIDER_CALLS'));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));
        fireEvent.click(screen.getByTestId('proposed-refund-decline-submit'));

        expect(await screen.findByTestId('proposed-refund-error')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.rejections.REFUND_HAS_PROVIDER_CALLS')
        );
        expect(screen.getByTestId('proposed-refund-decline')).toBeEnabled();
    });
});

describe('HOS-2400 confirm is only for REQUESTED refunds', () => {
    it('hides Confirm on a CONFIRMED row and says it can only be declined', () => {
        listOf(refundWith({ status: 'CONFIRMED' }));
        render(<ProposedRefundsScreen />);

        expect(screen.queryByTestId('proposed-refund-confirm')).not.toBeInTheDocument();
        expect(screen.getByTestId('proposed-refund-confirmed-only-decline')).toHaveTextContent(
            tr('admin-billing.proposedRefunds.confirmedOnlyDecline')
        );
        expect(screen.getByTestId('proposed-refund-decline')).toBeEnabled();
    });

    it('keeps Confirm and no such line on a REQUESTED row', () => {
        render(<ProposedRefundsScreen />);

        expect(screen.getByTestId('proposed-refund-confirm')).toBeInTheDocument();
        expect(
            screen.queryByTestId('proposed-refund-confirmed-only-decline')
        ).not.toBeInTheDocument();
    });
});

describe('HOS-2400 a double click sends one request', () => {
    it('posts one confirm for two clicks in the same tick', async () => {
        let release: (value: unknown) => void = () => undefined;
        state.confirm.mockReturnValue(new Promise((resolve) => (release = resolve)));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-confirm'));
        const submit = screen.getByTestId('proposed-refund-confirm-submit');
        fireEvent.click(submit);
        fireEvent.click(submit);

        expect(state.confirm).toHaveBeenCalledTimes(1);
        release({ refundId: REFUND_ID, status: 'CONFIRMED', outcome: 'SENT', calls: [] });
        await waitFor(() => expect(state.addToast).toHaveBeenCalled());
    });

    it('posts one decline for two clicks in the same tick', async () => {
        let release: (value: unknown) => void = () => undefined;
        state.decline.mockReturnValue(new Promise((resolve) => (release = resolve)));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-decline'));
        const submit = screen.getByTestId('proposed-refund-decline-submit');
        fireEvent.click(submit);
        fireEvent.click(submit);

        expect(state.decline).toHaveBeenCalledTimes(1);
        release({ refundId: REFUND_ID, status: 'FAILED' });
        await waitFor(() => expect(state.addToast).toHaveBeenCalled());
    });

    it('accepts a new click once the first request failed', async () => {
        state.confirm.mockRejectedValueOnce(conflict('REFUND_STATE_CHANGED'));
        render(<ProposedRefundsScreen />);

        fireEvent.click(screen.getByTestId('proposed-refund-confirm'));
        fireEvent.click(screen.getByTestId('proposed-refund-confirm-submit'));
        await screen.findByTestId('proposed-refund-error');
        fireEvent.click(screen.getByTestId('proposed-refund-confirm-submit'));

        await waitFor(() => expect(state.confirm).toHaveBeenCalledTimes(2));
    });
});

describe('HOS-2400 derived state', () => {
    it('unlocks decline when a refetch says the refund no longer closes a held charge', () => {
        listOf(refundWith({ closesHeldCharge: true }));
        const view = render(<ProposedRefundsScreen />);
        expect(screen.getByTestId('proposed-refund-decline')).toBeDisabled();

        listOf(refundWith({ closesHeldCharge: false }));
        view.rerender(<ProposedRefundsScreen />);

        expect(screen.getByTestId('proposed-refund-decline')).toBeEnabled();
    });

    it('steps back to the new last page when the last row of the last page is resolved', async () => {
        state.list.data = {
            items: [refundWith()],
            pagination: { page: 1, pageSize: 50, total: 51, totalPages: 2 }
        };
        const view = render(<ProposedRefundsScreen />);
        fireEvent.click(screen.getByText(tr('admin-billing.proposedRefunds.next')));
        expect(state.pages.at(-1)).toBe(2);

        state.list.data = {
            items: [],
            pagination: { page: 2, pageSize: 50, total: 50, totalPages: 1 }
        };
        view.rerender(<ProposedRefundsScreen />);

        await waitFor(() => expect(state.pages.at(-1)).toBe(1));
        listOf(refundWith());
        view.rerender(<ProposedRefundsScreen />);
        expect(screen.getByTestId('proposed-refund')).toBeInTheDocument();
    });
});
