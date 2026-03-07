/**
 * @file subscription-billing.test.tsx
 * @description Integration tests for SubscriptionDashboard, SubscriptionCard,
 * CancelSubscriptionDialog, and ChangePlanDialog.
 *
 * SubscriptionCard: loading state, error state with retry, free plan view,
 *   active subscription view, action buttons per status.
 * CancelSubscriptionDialog: renders consequences, confirm/cancel buttons,
 *   API call on confirm, success/error toast.
 * ChangePlanDialog: fetches plans on open, plan grid, current plan badge,
 *   downgrade warning, confirm button state.
 * SubscriptionDashboard: renders SubscriptionCard, conditionally renders
 *   paid sections only when hasPaidPlan.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params) return `${fallback ?? key}`;
            return fallback ?? key;
        },
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
    CheckIcon: () => <div data-testid="check-icon" />,
    RefreshIcon: () => <div data-testid="refresh-icon" />,
    CloseIcon: () => <div data-testid="close-icon" />
}));

vi.mock('@repo/i18n', () => ({
    formatDate: ({ date }: { date: string }) => date,
    formatCurrency: ({ value }: { value: number }) => `$${value}`,
    toBcp47Locale: (locale: string) => locale
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

const mockGetSubscription = vi.fn();
const mockCancelSubscription = vi.fn();
const mockChangePlan = vi.fn();
const mockListPlans = vi.fn();
const mockReactivateSubscription = vi.fn();
const mockCreateCheckout = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: {
        getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
        getReviews: vi.fn(),
        patchProfile: vi.fn()
    },
    billingApi: {
        cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
        changePlan: (...args: unknown[]) => mockChangePlan(...args),
        listPlans: (...args: unknown[]) => mockListPlans(...args),
        reactivateSubscription: (...args: unknown[]) => mockReactivateSubscription(...args),
        createCheckout: (...args: unknown[]) => mockCreateCheckout(...args)
    },
    userBookmarksApi: { list: vi.fn(), delete: vi.fn() }
}));

// Stub heavy sub-components of SubscriptionDashboard
vi.mock('../../../src/components/account/UsageOverview.client', () => ({
    UsageOverview: () => <div data-testid="usage-overview" />
}));
vi.mock('../../../src/components/account/ActiveAddons.client', () => ({
    ActiveAddons: () => <div data-testid="active-addons" />
}));
vi.mock('../../../src/components/account/InvoiceHistory.client', () => ({
    InvoiceHistory: () => <div data-testid="invoice-history" />
}));
vi.mock('../../../src/components/account/PaymentHistory.client', () => ({
    PaymentHistory: () => <div data-testid="payment-history" />
}));

// Modal uses native <dialog>; jsdom has limited support.
// Mock it to render children directly so dialog tests work.
vi.mock('../../../src/components/ui/Modal.client', () => ({
    Modal: ({
        children,
        title,
        open
    }: {
        children: React.ReactNode;
        title: string;
        open: boolean;
    }) =>
        open ? (
            <div
                data-testid="modal"
                data-title={title}
            >
                {children}
            </div>
        ) : null
}));

import { CancelSubscriptionDialog } from '../../../src/components/account/CancelSubscriptionDialog.client';
import { ChangePlanDialog } from '../../../src/components/account/ChangePlanDialog.client';
import { SubscriptionCard } from '../../../src/components/account/SubscriptionCard.client';
import { SubscriptionDashboard } from '../../../src/components/account/SubscriptionDashboard.client';
import { addToast } from '../../../src/store/toast-store';

const addToastMock = addToast as ReturnType<typeof vi.fn>;

const activeSubscription = {
    planSlug: 'pro',
    planName: 'Pro Plan',
    status: 'active' as const,
    monthlyPriceArs: 5000,
    currentPeriodEnd: '2026-04-06T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    gracePeriodDaysRemaining: null,
    paymentMethod: null
};

const _freePlanSubscription = {
    planSlug: 'free',
    planName: 'Free Plan',
    status: 'active' as const,
    monthlyPriceArs: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    gracePeriodDaysRemaining: null,
    paymentMethod: null
};

beforeEach(() => {
    addToastMock.mockClear();
    mockGetSubscription.mockClear();
    mockCancelSubscription.mockClear();
    mockChangePlan.mockClear();
    mockListPlans.mockClear();
});

// ────────────────────────────────────────────────────────────
// SubscriptionCard
// ────────────────────────────────────────────────────────────

describe('SubscriptionCard.client.tsx', () => {
    describe('Loading state', () => {
        it('should show loading state while fetching', async () => {
            mockGetSubscription.mockReturnValueOnce(new Promise(() => undefined));

            render(
                <SubscriptionCard
                    locale="es"
                    upgradeHref="/es/precios"
                />
            );

            // The loading state renders the text in two places (sr-only and visible span).
            // Use getAllByText to handle multiple matches.
            expect(screen.getAllByText('subscription.loading').length).toBeGreaterThan(0);
        });

        it('should render an output element with aria-busy=true during loading', async () => {
            mockGetSubscription.mockReturnValueOnce(new Promise(() => undefined));

            render(
                <SubscriptionCard
                    locale="es"
                    upgradeHref="/es/precios"
                />
            );

            const output = document.querySelector('output[aria-busy="true"]');
            expect(output).toBeInTheDocument();
        });
    });

    describe('Error state', () => {
        it('should show error state when API call fails', async () => {
            mockGetSubscription.mockRejectedValueOnce(new Error('Network error'));

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.loadError')).toBeInTheDocument();
            });
        });

        it('should show a retry button in error state', async () => {
            mockGetSubscription.mockRejectedValueOnce(new Error('Network error'));

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.retry')).toBeInTheDocument();
            });
        });

        it('should retry fetching when retry button is clicked', async () => {
            mockGetSubscription
                .mockRejectedValueOnce(new Error('Error'))
                .mockResolvedValueOnce({ ok: true, data: { subscription: activeSubscription } });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => screen.getByText('subscription.retry'));

            await act(async () => {
                fireEvent.click(screen.getByText('subscription.retry'));
            });

            await waitFor(() => {
                expect(screen.getByText('Pro Plan')).toBeInTheDocument();
            });
        });
    });

    describe('Free plan view', () => {
        it('should render free plan name when no subscription data', async () => {
            mockGetSubscription.mockResolvedValueOnce({ ok: true, data: { subscription: null } });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.freePlanName')).toBeInTheDocument();
            });
        });

        it('should render upgrade CTA for free plan', async () => {
            mockGetSubscription.mockResolvedValueOnce({ ok: true, data: { subscription: null } });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.upgradeButton')).toBeInTheDocument();
            });
        });
    });

    describe('Active subscription view', () => {
        it('should display the plan name', async () => {
            mockGetSubscription.mockResolvedValueOnce({
                ok: true,
                data: { subscription: activeSubscription }
            });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('Pro Plan')).toBeInTheDocument();
            });
        });

        it('should render change-plan and cancel buttons for active status', async () => {
            mockGetSubscription.mockResolvedValueOnce({
                ok: true,
                data: { subscription: activeSubscription }
            });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                        onChangePlan={vi.fn()}
                        onCancelSubscription={vi.fn()}
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.changePlanButton')).toBeInTheDocument();
                expect(screen.getByText('subscription.cancelButton')).toBeInTheDocument();
            });
        });

        it('should call onChangePlan when change-plan button is clicked', async () => {
            const onChangePlan = vi.fn();
            mockGetSubscription.mockResolvedValueOnce({
                ok: true,
                data: { subscription: activeSubscription }
            });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                        onChangePlan={onChangePlan}
                        onCancelSubscription={vi.fn()}
                    />
                );
            });

            await waitFor(() => screen.getByText('subscription.changePlanButton'));
            fireEvent.click(screen.getByText('subscription.changePlanButton'));
            expect(onChangePlan).toHaveBeenCalledTimes(1);
        });

        it('should render reactivate button for cancelled/expired status', async () => {
            const cancelledSubscription = { ...activeSubscription, status: 'cancelled' as const };
            mockGetSubscription.mockResolvedValueOnce({
                ok: true,
                data: { subscription: cancelledSubscription }
            });

            await act(async () => {
                render(
                    <SubscriptionCard
                        locale="es"
                        upgradeHref="/es/precios"
                        onReactivate={vi.fn()}
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.reactivateButton')).toBeInTheDocument();
            });
        });
    });
});

// ────────────────────────────────────────────────────────────
// CancelSubscriptionDialog
// ────────────────────────────────────────────────────────────

describe('CancelSubscriptionDialog.client.tsx', () => {
    describe('When open', () => {
        it('should render the dialog content when open=true', () => {
            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-1"
                    locale="es"
                />
            );
            expect(screen.getByTestId('modal')).toBeInTheDocument();
        });

        it('should NOT render the dialog when open=false', () => {
            render(
                <CancelSubscriptionDialog
                    open={false}
                    onClose={vi.fn()}
                    subscriptionId="sub-1"
                    locale="es"
                />
            );
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
        });

        it('should render 3 consequence list items', () => {
            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-1"
                    locale="es"
                />
            );
            const items = screen.getAllByRole('listitem');
            expect(items).toHaveLength(3);
        });

        it('should render go-back and confirm buttons', () => {
            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-1"
                    locale="es"
                />
            );
            expect(screen.getByText('subscription.cancelGoBack')).toBeInTheDocument();
            expect(screen.getByText('subscription.cancelConfirmButton')).toBeInTheDocument();
        });

        it('should call onClose when go-back button is clicked', () => {
            const onClose = vi.fn();
            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={onClose}
                    subscriptionId="sub-1"
                    locale="es"
                />
            );
            fireEvent.click(screen.getByText('subscription.cancelGoBack'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Confirm cancellation', () => {
        it('should call billingApi.cancelSubscription with subscriptionId on confirm', async () => {
            mockCancelSubscription.mockResolvedValueOnce({ ok: true });

            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-abc"
                    locale="es"
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByText('subscription.cancelConfirmButton'));
            });

            expect(mockCancelSubscription).toHaveBeenCalledWith({
                subscriptionId: 'sub-abc'
            });
        });

        it('should show success toast and call onClose on successful cancel', async () => {
            const onClose = vi.fn();
            mockCancelSubscription.mockResolvedValueOnce({ ok: true });

            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={onClose}
                    subscriptionId="sub-abc"
                    locale="es"
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByText('subscription.cancelConfirmButton'));
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('should show error toast when cancellation API fails', async () => {
            mockCancelSubscription.mockRejectedValueOnce(new Error('API error'));

            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-abc"
                    locale="es"
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByText('subscription.cancelConfirmButton'));
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should disable buttons during submission', async () => {
            let resolvePromise!: (val: unknown) => void;
            mockCancelSubscription.mockReturnValueOnce(
                new Promise((res) => {
                    resolvePromise = res;
                })
            );

            render(
                <CancelSubscriptionDialog
                    open={true}
                    onClose={vi.fn()}
                    subscriptionId="sub-abc"
                    locale="es"
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByText('subscription.cancelConfirmButton'));
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.cancelGoBack')).toBeDisabled();
            });

            // Resolve the pending promise so the component can clean up properly
            await act(async () => {
                resolvePromise({ ok: true });
            });
        });
    });
});

// ────────────────────────────────────────────────────────────
// ChangePlanDialog
// ────────────────────────────────────────────────────────────

const samplePlans = [
    {
        id: 'plan-free',
        slug: 'free',
        name: 'Free',
        description: 'Free tier',
        features: ['Feature A'],
        prices: [{ billingInterval: 'monthly', unitAmount: 0, currency: 'ARS' }]
    },
    {
        id: 'plan-pro',
        slug: 'pro',
        name: 'Pro',
        description: 'Pro tier',
        features: ['Feature B', 'Feature C'],
        prices: [{ billingInterval: 'monthly', unitAmount: 500000, currency: 'ARS' }]
    }
];

describe('ChangePlanDialog.client.tsx', () => {
    describe('When open', () => {
        it('should fetch plans when dialog opens', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            expect(mockListPlans).toHaveBeenCalledTimes(1);
        });

        it('should render plan buttons after loading', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('Free')).toBeInTheDocument();
                expect(screen.getByText('Pro')).toBeInTheDocument();
            });
        });

        it('should mark the current plan with a badge', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => {
                expect(screen.getByText('subscription.currentPlanBadge')).toBeInTheDocument();
            });
        });

        it('should disable the current plan button', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => {
                const freeButton = screen.getByRole('button', {
                    name: /Free.*subscription.currentPlanBadge/i
                });
                expect(freeButton).toBeDisabled();
            });
        });

        it('should show downgrade warning when selecting a lower-tier plan', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="pro"
                        locale="es"
                    />
                );
            });

            // Select the free plan (lower tier)
            await waitFor(() => screen.getByText('Free'));
            fireEvent.click(screen.getByRole('button', { name: /Free/ }));

            await waitFor(() => {
                expect(
                    screen.getByText('subscription.changePlanDowngradeWarning')
                ).toBeInTheDocument();
            });
        });

        it('should keep confirm button disabled when no plan is selected', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => screen.getByText('Free'));

            const confirmBtn = screen.getByText('subscription.changePlanButton');
            expect(confirmBtn).toBeDisabled();
        });

        it('should enable confirm button after selecting a plan', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => screen.getByText('Pro'));
            fireEvent.click(screen.getByRole('button', { name: /Pro/ }));

            await waitFor(() => {
                const confirmBtn = screen.getByText(/subscription.changePlanConfirm/);
                expect(confirmBtn).not.toBeDisabled();
            });
        });
    });

    describe('Confirm plan change', () => {
        it('should call billingApi.changePlan with selected plan id', async () => {
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });
            mockChangePlan.mockResolvedValueOnce({ ok: true });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={vi.fn()}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => screen.getByText('Pro'));
            fireEvent.click(screen.getByRole('button', { name: /Pro/ }));

            await waitFor(() => screen.getByText(/subscription.changePlanConfirm/));

            await act(async () => {
                fireEvent.click(screen.getByText(/subscription.changePlanConfirm/));
            });

            expect(mockChangePlan).toHaveBeenCalledWith({
                planId: 'plan-pro',
                billingInterval: 'monthly'
            });
        });

        it('should show success toast and close dialog on successful change', async () => {
            const onClose = vi.fn();
            mockListPlans.mockResolvedValueOnce({
                ok: true,
                data: { items: samplePlans }
            });
            mockChangePlan.mockResolvedValueOnce({ ok: true });

            await act(async () => {
                render(
                    <ChangePlanDialog
                        open={true}
                        onClose={onClose}
                        currentPlanSlug="free"
                        locale="es"
                    />
                );
            });

            await waitFor(() => screen.getByText('Pro'));
            fireEvent.click(screen.getByRole('button', { name: /Pro/ }));
            await waitFor(() => screen.getByText(/subscription.changePlanConfirm/));

            await act(async () => {
                fireEvent.click(screen.getByText(/subscription.changePlanConfirm/));
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });
    });
});

// ────────────────────────────────────────────────────────────
// SubscriptionDashboard
// ────────────────────────────────────────────────────────────

describe('SubscriptionDashboard.client.tsx', () => {
    it('should render SubscriptionCard', async () => {
        mockGetSubscription
            .mockResolvedValueOnce({ ok: true, data: { subscription: null } })
            // SubscriptionCard also calls getSubscription
            .mockResolvedValueOnce({ ok: true, data: { subscription: null } });

        await act(async () => {
            render(<SubscriptionDashboard locale="es" />);
        });

        // SubscriptionCard renders free plan name when no data
        await waitFor(() => {
            expect(screen.getByText('subscription.freePlanName')).toBeInTheDocument();
        });
    });

    it('should NOT render paid sections for free plan', async () => {
        mockGetSubscription
            .mockResolvedValueOnce({ ok: true, data: { subscription: null } })
            .mockResolvedValueOnce({ ok: true, data: { subscription: null } });

        await act(async () => {
            render(<SubscriptionDashboard locale="es" />);
        });

        await waitFor(() => screen.getByText('subscription.freePlanName'));

        expect(screen.queryByTestId('usage-overview')).not.toBeInTheDocument();
        expect(screen.queryByTestId('active-addons')).not.toBeInTheDocument();
        expect(screen.queryByTestId('invoice-history')).not.toBeInTheDocument();
        expect(screen.queryByTestId('payment-history')).not.toBeInTheDocument();
    });

    it('should render paid sections when user has active non-free subscription', async () => {
        // Dashboard calls getSubscription once, SubscriptionCard calls it again
        mockGetSubscription
            .mockResolvedValueOnce({
                ok: true,
                data: { subscription: activeSubscription }
            })
            .mockResolvedValueOnce({
                ok: true,
                data: { subscription: activeSubscription }
            });

        await act(async () => {
            render(<SubscriptionDashboard locale="es" />);
        });

        await waitFor(() => {
            expect(screen.getByTestId('usage-overview')).toBeInTheDocument();
            expect(screen.getByTestId('active-addons')).toBeInTheDocument();
            expect(screen.getByTestId('invoice-history')).toBeInTheDocument();
            expect(screen.getByTestId('payment-history')).toBeInTheDocument();
        });
    });
});
