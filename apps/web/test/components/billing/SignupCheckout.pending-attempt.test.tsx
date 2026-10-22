import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCheckout } from '@/components/billing/SignupCheckout.client';

const api = vi.hoisted(() => ({
    start: vi.fn(),
    cancelPendingAttempt: vi.fn(),
    signupNotice: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: api }));

const pendingAttempt = {
    subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
    plan: { name: 'Básico', amount: 1500000, currency: 'ARS' as const, cycle: 'monthly' as const },
    checkoutUrl: 'https://payments.example/continue',
    authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
};
const props = {
    locale: 'es' as const,
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null
};
beforeEach(() => vi.resetAllMocks());

describe('TEST:1735:11 pending attempt checkout panel', () => {
    it('shows pending plan, amount, cycle, date and only resume/cancel actions', () => {
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={pendingAttempt}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        const panel = island.getByTestId('signup-checkout-pending-attempt');
        expect(panel).toHaveAttribute('data-subscription-id', pendingAttempt.subscriptionId);
        expect(panel).toHaveTextContent('Básico');
        expect(panel).toHaveTextContent('$ 15.000');
        expect(panel).toHaveTextContent('por mes');
        expect(panel).toHaveTextContent('12 de octubre de 2026');
        expect(island.getByTestId('signup-checkout-pending-attempt-resume')).toHaveAttribute(
            'href',
            pendingAttempt.checkoutUrl
        );
        expect(island.queryByTestId('signup-checkout-confirm')).toBeNull();
        expect(island.queryByTestId('signup-checkout-payer-email')).toBeNull();
    });

    it('omits resume when checkoutUrl is null and keeps cancel', () => {
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={{ ...pendingAttempt, checkoutUrl: null }}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        expect(island.queryByTestId('signup-checkout-pending-attempt-resume')).toBeNull();
        expect(island.getByTestId('signup-checkout-pending-attempt-cancel')).toBeInTheDocument();
    });

    it('TEST:1735:11 sanitizes the displayed resume href', () => {
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={{
                    ...pendingAttempt,
                    checkoutUrl: '  https://payments.example/continue  '
                }}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        expect(island.getByTestId('signup-checkout-pending-attempt-resume')).toHaveAttribute(
            'href',
            pendingAttempt.checkoutUrl
        );
    });

    it('TEST:1735:12 cancels once and restores the form, or shows API rejection', async () => {
        api.cancelPendingAttempt.mockResolvedValueOnce({
            ok: true,
            data: { outcome: 'ABANDONED' }
        });
        const { unmount } = render(
            <SignupCheckout
                {...props}
                pendingAttempt={pendingAttempt}
            />
        );
        let island = within(screen.getByTestId('signup-checkout'));
        fireEvent.click(island.getByTestId('signup-checkout-pending-attempt-cancel'));
        expect(api.cancelPendingAttempt).toHaveBeenCalledWith({
            subscriptionId: pendingAttempt.subscriptionId
        });
        expect(
            await island.findByTestId('signup-checkout-pending-attempt-cancelled')
        ).toBeInTheDocument();
        expect(island.queryByTestId('signup-checkout-pending-attempt')).toBeNull();
        expect(island.getByTestId('signup-checkout-confirm')).toBeInTheDocument();
        unmount();
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={pendingAttempt}
            />
        );
        api.cancelPendingAttempt.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'COMMITMENT_TAKEN' }
        });
        island = within(screen.getByTestId('signup-checkout'));
        fireEvent.click(island.getByTestId('signup-checkout-pending-attempt-cancel'));
        expect(await island.findByTestId('signup-checkout-rejection')).toHaveAttribute(
            'data-reason',
            'COMMITMENT_TAKEN'
        );
    });

    it('TEST:1735:13 rereads after COMMITMENT_TAKEN and displays a newly found attempt', async () => {
        api.start.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'COMMITMENT_TAKEN' }
        });
        api.signupNotice.mockResolvedValueOnce({ ok: true, data: { pendingAttempt } });
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={null}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        fireEvent.click(island.getByTestId('signup-checkout-confirm'));
        expect(await island.findByTestId('signup-checkout-pending-attempt')).toBeInTheDocument();
    });

    it('TEST:1735:13 keeps the existing rejection when reread has no pendingAttempt', async () => {
        api.start.mockResolvedValueOnce({
            ok: false,
            error: { status: 409, reason: 'COMMITMENT_TAKEN' }
        });
        api.signupNotice.mockResolvedValueOnce({ ok: true, data: { pendingAttempt: null } });
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={null}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        fireEvent.click(island.getByTestId('signup-checkout-confirm'));
        expect(await island.findByTestId('signup-checkout-rejection')).toHaveAttribute(
            'data-reason',
            'COMMITMENT_TAKEN'
        );
    });

    it('without pendingAttempt keeps the current checkout form', () => {
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={null}
            />
        );
        const island = within(screen.getByTestId('signup-checkout'));
        expect(island.getByTestId('signup-checkout-confirm')).toBeInTheDocument();
        expect(island.getByTestId('signup-checkout-payer-email')).toBeInTheDocument();
    });
});
