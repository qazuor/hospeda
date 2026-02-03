/**
 * InvoicePaymentDialog Component Tests
 *
 * Tests for the InvoicePaymentDialog billing component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoicePaymentDialog } from '../../../src/components/billing/InvoicePaymentDialog';
import type { PaymentMethod } from '../../../src/lib/billing-api-client';

// Mock billing-api-client
vi.mock('../../../src/lib/billing-api-client', () => ({
    getPaymentMethods: vi.fn()
}));

import { getPaymentMethods } from '../../../src/lib/billing-api-client';

const mockGetPaymentMethods = vi.mocked(getPaymentMethods);
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('InvoicePaymentDialog', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should not render when isOpen is false', () => {
        render(
            <InvoicePaymentDialog
                isOpen={false}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display loading state while fetching payment methods', async () => {
        mockGetPaymentMethods.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                })
        );

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should render payment methods list', async () => {
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

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        expect(screen.getByText(/4242/)).toBeInTheDocument();
        expect(screen.getByText(/Mastercard/)).toBeInTheDocument();
        expect(screen.getByText(/5555/)).toBeInTheDocument();
    });

    it('should pre-select default payment method', async () => {
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

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            const selectedMethod = screen.getAllByRole('radio')[0] as HTMLInputElement;
            expect(selectedMethod.checked).toBe(true);
        });
    });

    it('should allow selecting a payment method', async () => {
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

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        const secondRadio = radios[1];
        if (secondRadio) {
            fireEvent.click(secondRadio);
            expect(secondRadio.checked).toBe(true);
        }
    });

    it('should format amount in ARS currency', async () => {
        mockGetPaymentMethods.mockResolvedValue([
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ]);

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={12500.5}
            />
        );

        await waitFor(() => {
            const amountElements = screen.getAllByText(/12\.500,50/);
            expect(amountElements.length).toBeGreaterThan(0);
        });
    });

    it('should submit payment with selected method', async () => {
        mockGetPaymentMethods.mockResolvedValue([
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ]);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const submitButton = screen.getByRole('button', { name: /Pagar/ });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/billing/invoices/inv_123/pay'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include'
                })
            );
        });
    });

    it('should show loading state during payment', async () => {
        mockGetPaymentMethods.mockResolvedValue([
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ]);

        mockFetch.mockImplementation(
            () =>
                new Promise(() => {
                    /* never resolves */
                })
        );

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const submitButton = screen.getByRole('button', { name: /Pagar/ });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(submitButton).toBeDisabled();
        });
    });

    it('should close dialog on successful payment', async () => {
        mockGetPaymentMethods.mockResolvedValue([
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ]);

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: { success: true } })
        });

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const submitButton = screen.getByRole('button', { name: /Pagar/ });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it('should display error message on payment failure', async () => {
        mockGetPaymentMethods.mockResolvedValue([
            {
                id: 'pm_1',
                type: 'card',
                last4: '4242',
                brand: 'Visa',
                isDefault: true
            }
        ]);

        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: {
                    message: 'Pago rechazado'
                }
            })
        });

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Visa/)).toBeInTheDocument();
        });

        const submitButton = screen.getByRole('button', { name: /Pagar/ });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Pago rechazado/)).toBeInTheDocument();
        });
    });

    it('should display empty state when no payment methods', async () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/No tenés métodos de pago guardados/)).toBeInTheDocument();
        });
    });

    it('should close dialog when close button clicked', async () => {
        mockGetPaymentMethods.mockResolvedValue([]);

        render(
            <InvoicePaymentDialog
                isOpen={true}
                onClose={mockOnClose}
                invoiceId="inv_123"
                amount={5000}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /Cerrar/ });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });
});
