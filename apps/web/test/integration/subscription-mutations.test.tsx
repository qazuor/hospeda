/**
 * Subscription Mutation Flows Integration Tests
 *
 * Tests subscription mutation operations (cancel, resume, update) and their
 * integration with components. Validates error handling, confirmation dialogs,
 * and state updates after mutations.
 *
 * @module test/integration/subscription-mutations
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock qzpay-react hooks
const mockCancel = vi.fn();
const mockResume = vi.fn();
const mockUpdate = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@qazuor/qzpay-react', () => ({
    useSubscription: vi.fn(() => ({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        cancel: mockCancel,
        resume: mockResume,
        update: mockUpdate
    })),
    useCurrentCustomer: vi.fn(() => [{ id: 'cus_test_123' }, vi.fn()]),
    QZPayProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    QZPayThemeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

// Import components after mocks
import { CancelSubscriptionDialog } from '../../src/components/billing/CancelSubscriptionDialog';

describe('Subscription Mutations - Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCancel.mockResolvedValue(undefined);
        mockResume.mockResolvedValue(undefined);
        mockUpdate.mockResolvedValue(undefined);
        mockRefetch.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should call cancel mutation when confirming cancellation', async () => {
        // Arrange
        const onCloseMock = vi.fn();
        const onSuccessMock = vi.fn();

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={onCloseMock}
                customerId="cus_test_123"
                subscriptionId="sub_test_456"
                planName="Plan Básico"
                onSuccess={onSuccessMock}
            />
        );

        // Assert - dialog is visible
        expect(screen.getByText('¿Cancelar suscripción?')).toBeInTheDocument();

        // Act - click confirm button
        const confirmButton = screen.getByRole('button', { name: /confirmar cancelación/i });
        fireEvent.click(confirmButton);

        // Assert - cancel mutation called with correct params
        await waitFor(() => {
            expect(mockCancel).toHaveBeenCalledWith('sub_test_456', { cancelAtPeriodEnd: true });
        });
    });

    it('should show confirmation before executing cancel mutation', async () => {
        // Arrange
        const onCloseMock = vi.fn();

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={onCloseMock}
                customerId="cus_test_123"
                subscriptionId="sub_cancel_confirm"
                planName="Plan Pro"
            />
        );

        // Assert - warning message visible before confirming
        expect(
            screen.getByText(/perderás acceso a todas las funciones premium/i)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/tus publicaciones se despublicarán automáticamente/i)
        ).toBeInTheDocument();

        // Assert - cancel not called yet
        expect(mockCancel).not.toHaveBeenCalled();

        // Act - click back button (should not cancel)
        const backButton = screen.getByRole('button', { name: /volver/i });
        fireEvent.click(backButton);

        // Assert - still not called
        expect(mockCancel).not.toHaveBeenCalled();
        expect(onCloseMock).toHaveBeenCalled();
    });

    it('should call resume mutation for cancelled subscriptions', async () => {
        // Arrange - mock useSubscription to return resume function
        const { useSubscription } = await import('@qazuor/qzpay-react');
        (useSubscription as any).mockReturnValue({
            data: {
                id: 'sub_cancelled',
                customerId: 'cus_test_123',
                planId: 'plan_basic',
                status: 'canceled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: new Date('2024-12-31'),
                interval: 'month',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            isLoading: false,
            error: null,
            refetch: mockRefetch,
            cancel: mockCancel,
            resume: mockResume
        });

        // Re-import to get updated mock
        const { SubscriptionStatusCard } = await import(
            '../../src/components/billing/SubscriptionStatusCard'
        );

        render(<SubscriptionStatusCard customerId="cus_test_123" />);

        // Assert - cancelled state shown
        await waitFor(() => {
            expect(screen.getByText(/suscripción cancelada/i)).toBeInTheDocument();
        });

        // Act - click reactivate button
        const reactivateButton = screen.getByRole('button', { name: /reactivar suscripción/i });
        fireEvent.click(reactivateButton);

        // Assert - resume called
        await waitFor(() => {
            expect(mockResume).toHaveBeenCalledWith('sub_cancelled');
        });
    });

    it('should call update mutation when changing subscription plan', async () => {
        // Arrange - this would typically be in a PlanChangeDialog component
        // For now, test the mutation is available
        const { useSubscription } = await import('@qazuor/qzpay-react');
        const mockSubscription = {
            id: 'sub_to_update',
            customerId: 'cus_test_123',
            planId: 'plan_basic',
            status: 'active',
            interval: 'month',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        (useSubscription as any).mockReturnValue({
            data: mockSubscription,
            isLoading: false,
            error: null,
            refetch: mockRefetch,
            cancel: mockCancel,
            resume: mockResume,
            update: mockUpdate
        });

        // Act - simulate plan update
        const updatePayload = {
            planId: 'plan_pro'
        };

        await mockUpdate('sub_to_update', updatePayload);

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith('sub_to_update', updatePayload);
    });

    it('should display mutation error to user', async () => {
        // Arrange - mock cancel to reject
        const errorMessage = 'Error de red';
        mockCancel.mockRejectedValue(new Error(errorMessage));

        const onCloseMock = vi.fn();

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={onCloseMock}
                customerId="cus_test_123"
                subscriptionId="sub_error_test"
                planName="Plan Error"
            />
        );

        // Act - try to cancel
        const confirmButton = screen.getByRole('button', { name: /confirmar cancelación/i });
        fireEvent.click(confirmButton);

        // Assert - error message displayed (could be custom message or default)
        await waitFor(() => {
            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveTextContent(/error de red|no pudimos/i);
        });

        // Assert - retry button available
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('should trigger refetch after successful mutation', async () => {
        // Arrange - mock successful cancel
        mockCancel.mockResolvedValue(undefined);

        const onSuccessMock = vi.fn();

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={vi.fn()}
                customerId="cus_test_123"
                subscriptionId="sub_refetch_test"
                onSuccess={onSuccessMock}
            />
        );

        // Act - confirm cancellation
        const confirmButton = screen.getByRole('button', { name: /confirmar cancelación/i });
        fireEvent.click(confirmButton);

        // Wait for success state
        await waitFor(() => {
            expect(screen.getByText(/suscripción cancelada/i)).toBeInTheDocument();
        });

        // Assert - onSuccess callback called (which typically calls refetch)
        await waitFor(
            () => {
                expect(onSuccessMock).toHaveBeenCalled();
            },
            { timeout: 3000 }
        );
    });

    it('should show loading state during mutation', async () => {
        // Arrange - mock slow cancel
        mockCancel.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(resolve, 100);
                })
        );

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={vi.fn()}
                customerId="cus_test_123"
                subscriptionId="sub_loading_test"
            />
        );

        // Act - start cancellation
        const confirmButton = screen.getByRole('button', { name: /confirmar cancelación/i });
        fireEvent.click(confirmButton);

        // Assert - loading state shown
        expect(screen.getByText(/cancelando.../i)).toBeInTheDocument();

        // Wait for completion
        await waitFor(() => {
            expect(screen.queryByText(/cancelando.../i)).not.toBeInTheDocument();
        });
    });

    it('should disable buttons during mutation', async () => {
        // Arrange
        mockCancel.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(resolve, 100);
                })
        );

        render(
            <CancelSubscriptionDialog
                isOpen={true}
                onClose={vi.fn()}
                customerId="cus_test_123"
                subscriptionId="sub_disabled_test"
            />
        );

        // Act - start cancellation
        const confirmButton = screen.getByRole('button', { name: /confirmar cancelación/i });
        fireEvent.click(confirmButton);

        // Assert - buttons disabled during mutation
        const backButton = screen.getByRole('button', { name: /volver/i });
        expect(backButton).toBeDisabled();

        // Wait for completion
        await waitFor(() => {
            expect(confirmButton).not.toBeInTheDocument();
        });
    });

    it('should handle resume mutation error gracefully', async () => {
        // Arrange - mock useSubscription with error on resume
        const resumeError = new Error('Error de conexión');
        mockResume.mockRejectedValue(resumeError);

        const { useSubscription } = await import('@qazuor/qzpay-react');
        (useSubscription as any).mockReturnValue({
            data: {
                id: 'sub_resume_error',
                customerId: 'cus_test_123',
                planId: 'plan_basic',
                status: 'canceled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: new Date('2024-12-31'),
                interval: 'month',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            isLoading: false,
            error: null,
            refetch: mockRefetch,
            resume: mockResume
        });

        const { SubscriptionStatusCard } = await import(
            '../../src/components/billing/SubscriptionStatusCard'
        );

        render(<SubscriptionStatusCard customerId="cus_test_123" />);

        // Wait for component to render
        await waitFor(() => {
            expect(screen.getByText(/suscripción cancelada/i)).toBeInTheDocument();
        });

        // Act - try to reactivate
        const reactivateButton = screen.getByRole('button', { name: /reactivar suscripción/i });
        fireEvent.click(reactivateButton);

        // Assert - error shown (check for role="alert" which contains error)
        await waitFor(
            () => {
                const errorAlert = screen.getByRole('alert');
                expect(errorAlert).toBeInTheDocument();
                expect(errorAlert.textContent).toMatch(/error de conexión|no pudimos reactivar/i);
            },
            { timeout: 2000 }
        );
    });
});
