/**
 * PaymentMethodSection Component Tests
 *
 * Tests for the PaymentMethodSection billing component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodSection } from '../../../src/components/billing/PaymentMethodSection';
import type { UsePaymentMethodsReturn } from '../../../src/hooks/usePaymentMethods';
import type { PaymentMethod } from '../../../src/lib/billing-api-client';

// Mock usePaymentMethods hook
vi.mock('../../../src/hooks/usePaymentMethods', () => ({
    usePaymentMethods: vi.fn()
}));

import { usePaymentMethods } from '../../../src/hooks/usePaymentMethods';

const mockUsePaymentMethods = vi.mocked(usePaymentMethods);

describe('PaymentMethodSection', () => {
    const mockRefetch = vi.fn();
    const mockSetDefault = vi.fn();

    const createMockHookReturn = (
        overrides: Partial<UsePaymentMethodsReturn> = {}
    ): UsePaymentMethodsReturn => ({
        data: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        setDefault: mockSetDefault,
        isSettingDefault: false,
        ...overrides
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render loading state initially', () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                isLoading: true
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should render payment methods', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/Visa/)).toBeInTheDocument();
        expect(screen.getByText(/4242/)).toBeInTheDocument();
        expect(screen.getByText(/Mastercard/)).toBeInTheDocument();
        expect(screen.getByText(/5555/)).toBeInTheDocument();
    });

    it('should show default badge on default payment method', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/Predeterminado/)).toBeInTheDocument();
    });

    it('should call setDefault when set default button clicked', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        mockSetDefault.mockResolvedValue(undefined);

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        const setDefaultButtons = screen.getAllByRole('button', {
            name: /Establecer como predeterminado/
        });

        const firstButton = setDefaultButtons[0];
        if (firstButton) {
            fireEvent.click(firstButton);

            await waitFor(() => {
                expect(mockSetDefault).toHaveBeenCalledWith('pm_2');
            });
        }
    });

    it('should handle setDefault error gracefully', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        mockSetDefault.mockRejectedValue(new Error('Update failed'));

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        const setDefaultButtons = screen.getAllByRole('button', {
            name: /Establecer como predeterminado/
        });

        const firstButton = setDefaultButtons[0];
        if (firstButton) {
            fireEvent.click(firstButton);

            await waitFor(() => {
                expect(mockSetDefault).toHaveBeenCalledWith('pm_2');
            });

            expect(consoleErrorSpy).toHaveBeenCalled();
        }

        consoleErrorSpy.mockRestore();
    });

    it('should render empty state when no payment methods', async () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: []
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/No tenés métodos de pago configurados/)).toBeInTheDocument();
    });

    it('should render empty state when data is null', async () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: null
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/No tenés métodos de pago configurados/)).toBeInTheDocument();
    });

    it('should render error state on fetch failure', async () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                error: new Error('Network error')
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should retry fetching on error state retry button click', async () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                error: new Error('Network error')
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByRole('alert')).toBeInTheDocument();

        const retryButton = screen.getByRole('button', { name: /Reintentar/ });
        fireEvent.click(retryButton);

        expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it('should not show set default button on already default method', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/Visa/)).toBeInTheDocument();

        expect(
            screen.queryByRole('button', { name: /Establecer como predeterminado/ })
        ).not.toBeInTheDocument();
    });

    it('should render empty state without props', async () => {
        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: []
            })
        );

        render(<PaymentMethodSection />);

        expect(screen.getByText(/No tenés métodos de pago configurados/)).toBeInTheDocument();
    });

    it('should disable set default button and show "Actualizando..." while setting default', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: false
            }
        ];

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods,
                isSettingDefault: true
            })
        );

        render(<PaymentMethodSection />);

        // Check button text changed
        const updatingText = screen.getByText(/Actualizando.../);
        expect(updatingText).toBeInTheDocument();

        // Check button is disabled
        const button = updatingText.closest('button');
        expect(button).not.toBeNull();
        expect(button).toBeDisabled();
    });

    it('should render add payment method CTA', async () => {
        const mockMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ];

        mockUsePaymentMethods.mockReturnValue(
            createMockHookReturn({
                data: mockMethods
            })
        );

        render(<PaymentMethodSection />);

        const addLink = screen.getByRole('link', { name: /Agregar método de pago/ });
        expect(addLink).toBeInTheDocument();
        expect(addLink).toHaveAttribute('href', '/mi-cuenta/payment-methods/add');
    });
});
