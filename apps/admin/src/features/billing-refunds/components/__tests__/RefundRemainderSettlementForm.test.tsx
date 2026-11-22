// @vitest-environment jsdom
/** Tests for the remainder settlement of a partially accepted refund (action 14, HOS-2406). */

import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { buildRefundRemainderPath } from '../../hooks/useSettleRefundRemainder';
import { ProposedRefundsScreen } from '../ProposedRefundsScreen';
import { RefundRemainderSettlementForm } from '../RefundRemainderSettlementForm';

const state = vi.hoisted(() => ({
    permissions: [] as string[],
    settle: vi.fn(),
    pending: false
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => state.permissions,
    useHasPermission: (permission: string) => state.permissions.includes(permission)
}));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es',
        t: (key: string, params?: Record<string, unknown>) => {
            const text = key
                .split('.')
                .slice(1)
                .reduce((obj: any, part) => obj?.[part], es) as string | undefined;
            return Object.entries(params ?? {}).reduce(
                (out, [name, value]) => out.replace(`{{${name}}}`, String(value)),
                text ?? key
            );
        }
    })
}));
vi.mock('../../hooks/useProposedRefunds', () => ({
    useProposedRefunds: () => ({
        isLoading: false,
        isError: false,
        data: { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
        refetch: vi.fn()
    })
}));
// The screen also renders the stuck-refund list (HOS-2560); its own tests cover it.
vi.mock('../../hooks/useStuckRefunds', () => ({
    useStuckRefunds: () => ({
        isLoading: false,
        isError: false,
        data: { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
        refetch: vi.fn()
    })
}));
// The screen also renders «Retry with MP» (HOS-2516); its mutation is out of this test's scope.
vi.mock('../../hooks/useRetryRefundProviderCalls', () => ({
    useRetryRefundProviderCalls: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock('../../hooks/useSettleRefundRemainder', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useSettleRefundRemainder: () => ({ mutateAsync: state.settle, isPending: state.pending })
}));

const REFUND_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const remainder = es.proposedRefunds.remainder;

function fill(input: { refundId?: string; amount?: string; reference?: string; note?: string }) {
    const set = (label: string, value: string | undefined) => {
        if (value !== undefined)
            fireEvent.change(screen.getByLabelText(label), { target: { value } });
    };
    set(remainder.refundId, input.refundId);
    set(remainder.amount, input.amount);
    set(remainder.reference, input.reference);
    set(remainder.note, input.note);
}

describe('RefundRemainderSettlementForm', () => {
    beforeEach(() => {
        state.permissions = [];
        state.settle.mockReset();
        state.pending = false;
    });

    it('sends the remainder in cents with the trimmed reference, after a review step', async () => {
        // Arrange
        state.settle.mockResolvedValue({
            refundId: REFUND_ID,
            status: 'EXECUTED',
            acceptedAmount: 400000,
            remainderAmount: 200050,
            paymentOutcome: 'P4',
            coverageReleased: false
        });
        render(<RefundRemainderSettlementForm />);

        // Act
        fill({
            refundId: ` ${REFUND_ID} `,
            amount: '2000.50',
            reference: ' mp-99 ',
            note: 'panel'
        });
        fireEvent.click(screen.getByRole('button', { name: remainder.review }));
        const confirmation = screen.getByTestId('refund-remainder-confirmation').textContent;
        fireEvent.click(screen.getByRole('button', { name: remainder.confirm }));

        // Assert
        expect(confirmation).toContain('mp-99');
        expect(confirmation).toContain(REFUND_ID);
        await waitFor(() =>
            expect(state.settle).toHaveBeenCalledWith({
                refundId: REFUND_ID,
                body: { amount: 200050, reference: 'mp-99', note: 'panel' }
            })
        );
        expect((await screen.findByRole('status')).textContent).toContain('4000,00');
    });

    it('keeps review disabled without a valid refund id, amount or reference', () => {
        // Arrange
        render(<RefundRemainderSettlementForm />);
        const review = () => screen.getByRole('button', { name: remainder.review });

        // Act
        fill({ refundId: 'not-a-uuid', amount: '20', reference: 'mp-1' });
        const badId = (review() as HTMLButtonElement).disabled;
        fill({ refundId: REFUND_ID, amount: '0' });
        const zero = (review() as HTMLButtonElement).disabled;
        fill({ amount: '20', reference: '  ' });
        const blank = (review() as HTMLButtonElement).disabled;
        fill({ reference: 'mp-1' });
        const ok = (review() as HTMLButtonElement).disabled;

        // Assert
        expect([badId, zero, blank, ok]).toEqual([true, true, true, false]);
        expect(state.settle).not.toHaveBeenCalled();
    });

    it.each([
        ['REMAINDER_AMOUNT_MISMATCH', remainder.rejections.REMAINDER_AMOUNT_MISMATCH],
        ['ACCEPTED_PART_NOT_ACCREDITED', remainder.rejections.ACCEPTED_PART_NOT_ACCREDITED],
        ['REMAINDER_NOT_FOUND_AT_PROVIDER', remainder.rejections.REMAINDER_NOT_FOUND_AT_PROVIDER],
        ['OTHER_REFUND_CALL_UNANSWERED', remainder.rejections.OTHER_REFUND_CALL_UNANSWERED],
        [
            'UNCITED_PROVIDER_REFUND_ON_CHARGE',
            remainder.rejections.UNCITED_PROVIDER_REFUND_ON_CHARGE
        ],
        ['REFUND_RETRY_IN_PROGRESS', remainder.rejections.REFUND_RETRY_IN_PROGRESS],
        ['REFUND_CALL_UNANSWERED', remainder.rejections.REFUND_CALL_UNANSWERED],
        ['REFUND_NOT_CONFIRMED', remainder.rejections.REFUND_NOT_CONFIRMED],
        ['REFUND_HAS_NO_ACCEPTED_CALL', remainder.rejections.REFUND_HAS_NO_ACCEPTED_CALL],
        [
            'EXTERNAL_REFERENCE_ALREADY_SETTLED',
            es.reconciliationMarks.action14.rejections.EXTERNAL_REFERENCE_ALREADY_SETTLED
        ]
    ])('shows the localized message of %s and goes back to the form', async (reason, message) => {
        // Arrange
        state.settle.mockRejectedValue(
            new ApiError('Conflict', { status: 409, body: { error: { reason } } })
        );
        render(<RefundRemainderSettlementForm />);

        // Act
        fill({ refundId: REFUND_ID, amount: '20', reference: 'mp-1' });
        fireEvent.click(screen.getByRole('button', { name: remainder.review }));
        fireEvent.click(screen.getByRole('button', { name: remainder.confirm }));

        // Assert
        expect((await screen.findByRole('alert')).textContent).toBe(message);
        expect(screen.getByRole('button', { name: remainder.review })).toBeTruthy();
    });

    it('is shown on the proposed-refunds screen only to who may run action 14', () => {
        // Arrange
        state.permissions = ['billing.refund'];

        // Act
        const { unmount } = render(<ProposedRefundsScreen />);
        const hidden = screen.queryByTestId('refund-remainder-settlement');
        unmount();
        state.permissions = ['billing.refund', 'billing.settleExternal'];
        render(<ProposedRefundsScreen />);

        // Assert
        expect(hidden).toBeNull();
        expect(screen.getByTestId('refund-remainder-settlement')).toBeTruthy();
        expect(screen.getByTestId('proposed-refunds-empty')).toBeTruthy();
    });

    it('builds the remainder path and carries every key in es, en and pt', () => {
        // Arrange
        const keysOf = (value: object, prefix = ''): string[] =>
            Object.entries(value).flatMap(([key, child]) =>
                typeof child === 'object' && child !== null
                    ? keysOf(child, `${prefix}${key}.`)
                    : [`${prefix}${key}`]
            );

        // Act
        const path = buildRefundRemainderPath({ refundId: REFUND_ID });

        // Assert
        expect(path).toBe(`/api/v1/admin/billing-refunds/${REFUND_ID}/settle-remainder`);
        expect(keysOf(en.proposedRefunds.remainder)).toEqual(keysOf(remainder));
        expect(keysOf(pt.proposedRefunds.remainder)).toEqual(keysOf(remainder));
    });
});
