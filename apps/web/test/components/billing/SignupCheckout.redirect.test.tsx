/** HOS-1896: a fresh signup goes straight to the provider checkout. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCheckout } from '@/components/billing/SignupCheckout.client';

const start = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { start } }));

const props = {
    locale: 'es' as const,
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/turistas/',
    trialNotice: null,
    touristVipNotice: null,
    planSummary: null,
    pendingAttempt: null,
    manualPaymentOnly: false
};

const safeCheckoutUrl = 'https://payments.example/continue';

function successWith(checkoutUrl: string | null) {
    return {
        ok: true,
        data: {
            subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
            authorizationId: 'authorization-1',
            checkoutUrl,
            vertical: 'tourist',
            authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
        }
    };
}

let restoreLocation: (() => void) | null = null;

// jsdom's window.location is non-configurable for assignment; redefine it with a
// setter so the component's `location.href = ...` is observable (HOS-1896).
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

beforeEach(() => vi.resetAllMocks());
afterEach(() => {
    restoreLocation?.();
    restoreLocation = null;
});

describe('HOS-1896 signup checkout redirect', () => {
    it('TEST:1896:1 navigates once to the sanitized URL and skips the pending screen', async () => {
        const navigate = stubNavigation();
        start.mockResolvedValue(successWith('  https://payments.example/continue  '));
        render(<SignupCheckout {...props} />);

        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));

        await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
        expect(navigate).toHaveBeenCalledWith(safeCheckoutUrl);
        expect(screen.queryByTestId('signup-checkout-pending')).toBeNull();
        expect(screen.getByTestId('signup-checkout')).toHaveAttribute('data-state', 'submitting');
    });

    it.each([
        null,
        'javascript:alert(1)'
    ])('TEST:1896:2 keeps the pending fallback without navigating for %s', async (checkoutUrl) => {
        const navigate = stubNavigation();
        start.mockResolvedValue(successWith(checkoutUrl));
        render(<SignupCheckout {...props} />);

        fireEvent.click(screen.getByTestId('signup-checkout-confirm'));

        expect(await screen.findByTestId('signup-checkout-pending')).toBeInTheDocument();
        expect(screen.queryByTestId('signup-checkout-resume-link')).toBeNull();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('TEST:1896:3 disables confirm while submitting and never starts twice', async () => {
        const navigate = stubNavigation();
        let resolveStart: (value: unknown) => void = () => undefined;
        start.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveStart = resolve;
                })
        );
        render(<SignupCheckout {...props} />);
        const confirm = screen.getByTestId('signup-checkout-confirm');

        fireEvent.click(confirm);
        await waitFor(() => expect(confirm).toBeDisabled());
        fireEvent.click(confirm);
        // The second click must be inert because the button itself is disabled,
        // not only because `start` has its own guard.
        expect(confirm).toBeDisabled();

        expect(start).toHaveBeenCalledTimes(1);
        resolveStart(successWith(safeCheckoutUrl));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(safeCheckoutUrl));
    });
});
