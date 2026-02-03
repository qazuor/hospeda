/**
 * PaymentMethodSection Component Tests
 *
 * Tests for the PaymentMethodSection billing component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodSection } from '../../../src/components/billing/PaymentMethodSection';
import type { PaymentMethod } from '../../../src/lib/billing-api-client';

// Mock billing-api-client
vi.mock('../../../src/lib/billing-api-client', () => ({
    getPaymentMethods: vi.fn(),
    updateDefaultPaymentMethod: vi.fn()
}));

import { getPaymentMethods, updateDefaultPaymentMethod } from '../../../src/lib/billing-api-client';

const mockGetPaymentMethods = vi.mocked(getPaymentMethods);
const mockUpdateDefaultPaymentMethod = vi.mocked(updateDefaultPaymentMethod);

describe('PaymentMethodSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render loading state initially', () => {
        mockGetPaymentMethods.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
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

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

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

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/Predeterminado/)).toBeInTheDocument();
        });
    });

    it('should call updateDefaultPaymentMethod when set default button clicked', async () => {
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

        mockGetPaymentMethods.mockResolvedValue(mockMethods);
        mockUpdateDefaultPaymentMethod.mockResolvedValue();

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/Mastercard/)).toBeInTheDocument();
        });

        const setDefaultButtons = screen.getAllByRole('button', {
            name: /Establecer como predeterminado/
        });

        const firstButton = setDefaultButtons[0];
        if (firstButton) {
            fireEvent.click(firstButton);

            await waitFor(() => {
                expect(mockUpdateDefaultPaymentMethod).toHaveBeenCalledWith('pm_2');
            });
        }
    });

    it('should refetch payment methods after setting default', async () => {
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

        const updatedMethods: PaymentMethod[] = [
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: false
            },
            {
                id: 'pm_2',
                type: 'card',
                last4: '5555',
                brand: 'Mastercard',
                isDefault: true
            }
        ];

        mockGetPaymentMethods
            .mockResolvedValueOnce(mockMethods)
            .mockResolvedValueOnce(updatedMethods);
        mockUpdateDefaultPaymentMethod.mockResolvedValue();

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const setDefaultButtons = screen.getAllByRole('button', {
            name: /Establecer como predeterminado/
        });

        const firstButton = setDefaultButtons[0];
        if (firstButton) {
            fireEvent.click(firstButton);

            await waitFor(() => {
                expect(mockGetPaymentMethods).toHaveBeenCalledTimes(2);
            });
        }
    });

    it('should render empty state when no payment methods', async () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/No tenés métodos de pago configurados/)).toBeInTheDocument();
        });
    });

    it('should render error state on fetch failure', async () => {
        mockGetPaymentMethods.mockRejectedValue(new Error('Network error'));

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('should retry fetching on error state retry button click', async () => {
        mockGetPaymentMethods
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce([
                {
                    id: 'pm_1',
                    type: 'card',
                    last4: '4242',
                    brand: 'Visa',
                    isDefault: true
                }
            ]);

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /Reintentar/ });
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });
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

        mockGetPaymentMethods.mockResolvedValue(mockMethods);

        render(<PaymentMethodSection />);

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        expect(
            screen.queryByRole('button', { name: /Establecer como predeterminado/ })
        ).not.toBeInTheDocument();
    });

    it('should use custom API URL when provided', async () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        render(<PaymentMethodSection apiUrl="https://custom-api.com" />);

        await waitFor(() => {
            expect(mockGetPaymentMethods).toHaveBeenCalled();
        });
    });
});
