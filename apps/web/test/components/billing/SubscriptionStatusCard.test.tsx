/**
 * SubscriptionStatusCard Component Tests
 *
 * Tests all states and functionality of the SubscriptionStatusCard component
 */

import type { QZPaySubscription } from '@qazuor/qzpay-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionStatusCard } from '../../../src/components/billing/SubscriptionStatusCard';
import * as billingStore from '../../../src/store/billing';

// Mock @qazuor/qzpay-react
vi.mock('@qazuor/qzpay-react', () => ({
    useSubscription: vi.fn()
}));

// Mock billing store
vi.mock('../../../src/store/billing', () => ({
    updateBillingSubscription: vi.fn()
}));

// Import after mocking
import { useSubscription } from '@qazuor/qzpay-react';

describe('SubscriptionStatusCard', () => {
    const mockCustomerId = 'cus_test123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Factory function to create mock subscriptions with required fields
     */
    function createMockSubscription(
        overrides: Partial<QZPaySubscription> & {
            planName?: string;
            price?: number;
            currency?: string;
        } = {}
    ): QZPaySubscription & { planName?: string; price?: number; currency?: string } {
        return {
            id: overrides.id || 'sub_test',
            customerId: overrides.customerId || mockCustomerId,
            planId: overrides.planId || 'plan_basic',
            status: overrides.status || 'active',
            interval: overrides.interval || 'month',
            intervalCount: overrides.intervalCount || 1,
            quantity: overrides.quantity || 1,
            currentPeriodStart: overrides.currentPeriodStart || new Date(),
            currentPeriodEnd: overrides.currentPeriodEnd || new Date('2026-03-02'),
            trialStart: overrides.trialStart !== undefined ? overrides.trialStart : null,
            trialEnd: overrides.trialEnd !== undefined ? overrides.trialEnd : null,
            cancelAt: overrides.cancelAt !== undefined ? overrides.cancelAt : null,
            canceledAt: overrides.canceledAt !== undefined ? overrides.canceledAt : null,
            cancelAtPeriodEnd:
                overrides.cancelAtPeriodEnd !== undefined ? overrides.cancelAtPeriodEnd : false,
            providerSubscriptionIds: overrides.providerSubscriptionIds || {},
            promoCodeId: overrides.promoCodeId,
            metadata: overrides.metadata || {},
            livemode: overrides.livemode !== undefined ? overrides.livemode : false,
            createdAt: overrides.createdAt || new Date(),
            updatedAt: overrides.updatedAt || new Date(),
            deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null,
            // Optional backend-populated fields
            planName: overrides.planName,
            price: overrides.price,
            currency: overrides.currency || 'ARS'
        };
    }

    describe('Loading State', () => {
        it('should render loading skeleton when isLoading is true', () => {
            (useSubscription as Mock).mockReturnValue({
                data: null,
                isLoading: true,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(
                screen.getByLabelText('Cargando información de suscripción')
            ).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('Error State', () => {
        it('should render error message when error exists', () => {
            const mockRefetch = vi.fn();
            (useSubscription as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: new Error('Network error'),
                refetch: mockRefetch
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('No pudimos cargar tu suscripción')).toBeInTheDocument();
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
        });

        it('should call refetch when retry button is clicked', async () => {
            const mockRefetch = vi.fn().mockResolvedValue(undefined);

            (useSubscription as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: new Error('Network error'),
                refetch: mockRefetch
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            const retryButton = screen.getByRole('button', { name: /reintentar/i });
            fireEvent.click(retryButton);

            await waitFor(() => {
                expect(mockRefetch).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Empty State', () => {
        it('should render empty state when data is null', () => {
            (useSubscription as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('No tenés suscripción activa')).toBeInTheDocument();
            expect(
                screen.getByText('Elegí un plan para comenzar a publicar tus alojamientos')
            ).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
                'href',
                '/precios/propietarios'
            );
        });

        it('should render empty state when data is empty array', () => {
            (useSubscription as Mock).mockReturnValue({
                data: [],
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('No tenés suscripción activa')).toBeInTheDocument();
        });

        it('should sync null to nanostore on empty state', () => {
            (useSubscription as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(billingStore.updateBillingSubscription).toHaveBeenCalledWith(null);
        });
    });

    describe('Trial State', () => {
        it('should render trial state when in trial period', () => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7); // 7 days from now

            const mockSubscription = createMockSubscription({
                id: 'sub_trial',
                planName: 'Plan Básico',
                status: 'trialing',
                trialEnd,
                currentPeriodEnd: trialEnd,
                price: 0
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('Plan Básico')).toBeInTheDocument();
            expect(screen.getByText('En prueba')).toBeInTheDocument();
            expect(screen.getByText(/Te quedan/i)).toBeInTheDocument();
            expect(screen.getByText(/7 días/i)).toBeInTheDocument();
            expect(screen.getByText('No se realizó ningún cobro')).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /suscribirse ahora/i })).toHaveAttribute(
                'href',
                '/precios/propietarios'
            );
        });

        it('should show singular "día" for 1 day remaining', () => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 1); // 1 day from now

            const mockSubscription = createMockSubscription({
                planName: 'Plan Básico',
                status: 'trialing',
                trialEnd
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText(/1 día/i)).toBeInTheDocument();
        });

        it('should sync trial subscription to nanostore', () => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7);

            const mockSubscription = createMockSubscription({
                planName: 'Plan Básico',
                status: 'trialing',
                trialEnd
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(billingStore.updateBillingSubscription).toHaveBeenCalledWith(mockSubscription);
        });
    });

    describe('Active Subscription State', () => {
        it('should render active subscription with monthly billing', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'active',
                interval: 'month',
                price: 1500000 // 15000.00 ARS in cents
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('Plan Profesional')).toBeInTheDocument();
            expect(screen.getByText('Mensual')).toBeInTheDocument();
            expect(screen.getByText('Activa')).toBeInTheDocument();
            expect(screen.getByText(/15\.000/i)).toBeInTheDocument();
            expect(screen.getByText(/1 de marzo de 2026/i)).toBeInTheDocument();
        });

        it('should render active subscription with annual billing', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'active',
                interval: 'year',
                price: 15000000, // 150000.00 ARS in cents
                currentPeriodEnd: new Date('2027-02-02')
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('Anual')).toBeInTheDocument();
            expect(screen.getByText(/150\.000.*año/i)).toBeInTheDocument();
        });

        it('should render action buttons', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'active',
                price: 1500000
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByRole('button', { name: /cambiar de plan/i })).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /cancelar suscripción/i })
            ).toBeInTheDocument();
        });

        it('should open cancel dialog when cancel button is clicked', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'active',
                price: 1500000
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            const cancelButton = screen.getByRole('button', {
                name: /cancelar suscripción/i
            });
            fireEvent.click(cancelButton);

            // Dialog should appear
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/¿cancelar suscripción\?/i)).toBeInTheDocument();
        });

        it('should have button to open plan change dialog', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'active',
                price: 1500000
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            const changePlanButton = screen.getByRole('button', {
                name: /cambiar de plan/i
            });
            expect(changePlanButton).toBeInTheDocument();
        });
    });

    describe('Cancelled State', () => {
        it('should render cancelled state when subscription is cancelled but active until period end', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'canceled',
                cancelAtPeriodEnd: true,
                price: 1500000
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('Suscripción cancelada')).toBeInTheDocument();
            expect(screen.getByText(/Tu plan se cancelará el/i)).toBeInTheDocument();
            expect(screen.getByText(/1 de marzo de 2026/i)).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /reactivar suscripción/i })
            ).toBeInTheDocument();
        });

        it('should call resume mutation when reactivate button is clicked', async () => {
            const mockResume = vi.fn().mockResolvedValue({});
            const mockRefetch = vi.fn();
            const mockSubscription = createMockSubscription({
                planName: 'Plan Profesional',
                status: 'canceled',
                cancelAtPeriodEnd: true,
                price: 1500000
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: mockRefetch,
                resume: mockResume
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            const reactivateButton = screen.getByRole('button', {
                name: /reactivar suscripción/i
            });
            fireEvent.click(reactivateButton);

            await waitFor(() => {
                expect(mockResume).toHaveBeenCalledTimes(1);
                expect(mockResume).toHaveBeenCalledWith(mockSubscription.id);
            });

            // Should refetch after successful reactivation
            await waitFor(() => {
                expect(mockRefetch).toHaveBeenCalled();
            });
        });
    });

    describe('Status Badges', () => {
        const statusTests: Array<{
            status: QZPaySubscription['status'];
            label: string;
            colorClass: string;
            bgClass: string;
        }> = [
            {
                status: 'active',
                label: 'Activa',
                colorClass: 'text-green-700',
                bgClass: 'bg-green-100'
            },
            {
                status: 'past_due',
                label: 'Pago pendiente',
                colorClass: 'text-yellow-700',
                bgClass: 'bg-yellow-100'
            },
            {
                status: 'canceled',
                label: 'Cancelada',
                colorClass: 'text-red-700',
                bgClass: 'bg-red-100'
            },
            {
                status: 'paused',
                label: 'Pausada',
                colorClass: 'text-gray-700',
                bgClass: 'bg-gray-100'
            }
        ];

        // biome-ignore lint/complexity/noForEach: describe.each not available in this context
        statusTests.forEach(({ status, label, colorClass, bgClass }) => {
            it(`should render correct badge for ${status} status`, () => {
                const mockSubscription = createMockSubscription({
                    planName: 'Plan Test',
                    status,
                    price: 1000000
                });

                (useSubscription as Mock).mockReturnValue({
                    data: mockSubscription,
                    isLoading: false,
                    error: null,
                    refetch: vi.fn()
                });

                render(<SubscriptionStatusCard customerId={mockCustomerId} />);

                const badge = screen.getByText(label);
                expect(badge).toBeInTheDocument();
                expect(badge).toHaveClass(colorClass);
                expect(badge).toHaveClass(bgClass);
            });
        });

        it('should show trial badge for trialing status', () => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7);

            const mockSubscription = createMockSubscription({
                planName: 'Plan Test',
                status: 'trialing',
                trialEnd,
                price: 0
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            const badge = screen.getByText('En prueba');
            expect(badge).toBeInTheDocument();
            expect(badge).toHaveClass('text-blue-700');
            expect(badge).toHaveClass('bg-blue-100');
        });
    });

    describe('Price Formatting', () => {
        it('should format price in ARS correctly', () => {
            const mockSubscription = createMockSubscription({
                planName: 'Plan Test',
                status: 'active',
                price: 2599900 // 25999.00 ARS
            });

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscription,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            // Check for formatted price (allow for different formatting)
            expect(screen.getByText(/25\.999/i)).toBeInTheDocument();
        });
    });

    describe('Array Subscriptions', () => {
        it('should handle array of subscriptions and use first active one', () => {
            const mockSubscriptions = [
                createMockSubscription({
                    id: 'sub_paused',
                    planName: 'Plan Básico',
                    status: 'paused',
                    price: 500000
                }),
                createMockSubscription({
                    id: 'sub_active',
                    planName: 'Plan Profesional',
                    status: 'active',
                    price: 1500000
                })
            ];

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscriptions,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            // Should show the active subscription, not the paused one
            expect(screen.getByText('Plan Profesional')).toBeInTheDocument();
            expect(billingStore.updateBillingSubscription).toHaveBeenCalledWith(
                mockSubscriptions[1]
            );
        });

        it('should use first subscription if none are active', () => {
            const mockSubscriptions = [
                createMockSubscription({
                    id: 'sub_paused',
                    planName: 'Plan Básico',
                    status: 'paused',
                    price: 500000
                })
            ];

            (useSubscription as Mock).mockReturnValue({
                data: mockSubscriptions,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<SubscriptionStatusCard customerId={mockCustomerId} />);

            expect(screen.getByText('Plan Básico')).toBeInTheDocument();
            expect(billingStore.updateBillingSubscription).toHaveBeenCalledWith(
                mockSubscriptions[0]
            );
        });
    });
});
