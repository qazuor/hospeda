/**
 * Regression test for the dead Refund button (admin billing payments vocabulary bug).
 *
 * `PaymentsTable` used to gate the Refund button on `payment.status !== 'completed'`.
 * The API never sends `'completed'` — real payments come back as `'succeeded'` — so
 * the button was `disabled` for every payment that ever existed, no matter how the
 * money actually settled.
 *
 * The fixed contract (`AdminPaymentView`) serves `isRefundable` computed server-side
 * (`"succeeded, or partially refunded with money still outstanding"`), so the UI must
 * gate on that boolean directly instead of re-deriving eligibility from `status`.
 *
 * This test renders the REAL component and asserts the REAL `disabled` DOM attribute
 * — mounting is not enough, per repo convention: a button that "looks" enabled in a
 * snapshot but carries `disabled` in the DOM is still a dead button.
 */

// @vitest-environment jsdom

import type { AdminPaymentView } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsTable } from '../PaymentsTable';

function buildPayment(overrides: Partial<AdminPaymentView>): AdminPaymentView {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        amountInCents: 1800000,
        currency: 'ARS',
        refundedAmountInCents: 0,
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        user: {
            id: 'user-1',
            displayName: 'Leandro Asrilevich',
            email: 'leandro@example.com'
        },
        plan: {
            id: 'plan-1',
            slug: 'owner-basico',
            displayName: 'Basic',
            monthlyPriceInCents: 1000000,
            productDomain: 'accommodation'
        },
        subscriptionId: null,
        invoiceId: null,
        provider: 'mercadopago',
        providerPaymentId: 'mp_123',
        isRefundable: true,
        ...overrides
    };
}

describe('PaymentsTable — refund button gating (regression)', () => {
    it('enables the refund button when isRefundable is true, even though status is "succeeded" (never "completed")', () => {
        const refundablePayment = buildPayment({ id: 'refundable', isRefundable: true });

        render(
            <PaymentsTable
                payments={[refundablePayment]}
                isLoading={false}
                isError={false}
                onViewDetails={vi.fn()}
                onRefund={vi.fn()}
            />
        );

        const refundButton = screen.getByRole('button', {
            name: 'admin-billing.payments.refundButton'
        });
        expect(refundButton).not.toBeDisabled();
    });

    it('disables the refund button when the backend says the payment is not refundable', () => {
        const nonRefundablePayment = buildPayment({
            id: 'not-refundable',
            status: 'refunded',
            isRefundable: false
        });

        render(
            <PaymentsTable
                payments={[nonRefundablePayment]}
                isLoading={false}
                isError={false}
                onViewDetails={vi.fn()}
                onRefund={vi.fn()}
            />
        );

        const refundButton = screen.getByRole('button', {
            name: 'admin-billing.payments.refundButton'
        });
        expect(refundButton).toBeDisabled();
    });
});
