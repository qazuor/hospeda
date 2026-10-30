import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

let restoreLocation: (() => void) | null = null;

// jsdom's window.location is non-configurable for assignment; redefine it with a
// setter so HOS-1896 can assert the retake paths never navigate.
function stubNavigation() {
    const navigate = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
            ...originalLocation,
            set href(value: string) {
                navigate(value);
            }
        } as Location
    });
    restoreLocation = () => {
        window.location = originalLocation;
    };
    return navigate;
}

afterEach(() => {
    restoreLocation?.();
    restoreLocation = null;
});

describe('TEST:1735:11 pending attempt checkout panel', () => {
    it('TEST:1759:4 shows the localized plan name of the pending attempt', () => {
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={{
                    ...pendingAttempt,
                    plan: { ...pendingAttempt.plan, slug: 'owner-basico', name: 'Basic' }
                }}
            />
        );
        const panel = screen.getByTestId('signup-checkout-pending-attempt');
        expect(panel).toHaveTextContent('Básico');
        expect(panel).not.toHaveTextContent('Basic');
    });

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
        const navigate = stubNavigation();
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
        // AC:1896:4 — retaking an existing attempt is PendingAttemptPanel's job.
        expect(navigate).not.toHaveBeenCalled();
    });

    it('TEST:1896:4 shows an existing pending attempt without navigating away', () => {
        const navigate = stubNavigation();
        render(
            <SignupCheckout
                {...props}
                pendingAttempt={pendingAttempt}
            />
        );
        expect(screen.getByTestId('signup-checkout-pending-attempt')).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalled();
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
