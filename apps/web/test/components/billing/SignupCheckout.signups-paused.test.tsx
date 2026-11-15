import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SignupCheckout,
    type SignupCheckoutProps
} from '@/components/billing/SignupCheckout.client';

const start = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { start } }));
vi.mock('@/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({}, { get: (_target, property) => String(property) })
}));

const props: SignupCheckoutProps = {
    locale: 'es',
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/anfitriones/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null,
    pendingAttempt: null,
    manualPaymentOnly: false
};

beforeEach(() => vi.resetAllMocks());

describe('HOS-1749 the signup checkout shows the paused notice on 409 NEW_PAID_SIGNUPS_FROZEN', () => {
    it('renders the signup paused notice and hides checkout controls after the frozen response', async () => {
        start.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'NEW_PAID_SIGNUPS_FROZEN',
                message: 'New paid signups are paused.'
            }
        });
        const user = userEvent.setup();
        render(<SignupCheckout {...props} />);

        await user.click(screen.getByTestId('signup-checkout-confirm'));

        const notice = await screen.findByTestId('signup-checkout-paused-notice');
        expect(notice).toHaveAttribute('role', 'status');
        expect(screen.queryByTestId('signup-checkout-confirm')).toBeNull();
        expect(screen.queryByTestId('signup-checkout-rejection')).toBeNull();
        await waitFor(() =>
            expect(screen.getByTestId('signup-checkout')).toHaveAttribute('data-state', 'paused')
        );
    });

    it('keeps the existing rejection path for a different 409 code', async () => {
        start.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'COMMITMENT_TAKEN',
                reason: 'COMMITMENT_TAKEN',
                message: 'Another commitment exists.'
            }
        });
        const user = userEvent.setup();
        render(<SignupCheckout {...props} />);

        await user.click(screen.getByTestId('signup-checkout-confirm'));

        expect(await screen.findByTestId('signup-checkout-rejection')).toBeInTheDocument();
        expect(screen.queryByTestId('signup-checkout-paused-notice')).toBeNull();
    });
});
