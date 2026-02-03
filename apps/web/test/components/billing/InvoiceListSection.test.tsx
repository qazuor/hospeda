/**
 * InvoiceListSection Component Tests
 *
 * Tests for the InvoiceListSection billing component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceListSection } from '../../../src/components/billing/InvoiceListSection';

// Mock @qazuor/qzpay-react
vi.mock('@qazuor/qzpay-react', () => ({
    useInvoices: vi.fn()
}));

import { useInvoices } from '@qazuor/qzpay-react';

const mockUseInvoices = vi.mocked(useInvoices) as ReturnType<typeof vi.fn>;

describe('InvoiceListSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should render loading state initially', () => {
        mockUseInvoices.mockReturnValue({
            data: null,
            isLoading: true,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    it('should render invoices table', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Plan Pro - Enero 2026',
                amount: 10000,
                currency: 'ARS',
                status: 'paid',
                pdfUrl: 'https://example.com/invoice1.pdf'
            },
            {
                id: 'inv_2',
                createdAt: '2026-01-01T10:00:00Z',
                description: 'Plan Básico - Enero 2026',
                amount: 5000,
                currency: 'ARS',
                status: 'pending',
                pdfUrl: 'https://example.com/invoice2.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/Plan Pro - Enero 2026/)).toBeInTheDocument();
        });

        expect(screen.getByText(/Plan Básico - Enero 2026/)).toBeInTheDocument();
    });

    it('should render paid status badge', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'paid',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/Pagado/)).toBeInTheDocument();
        });
    });

    it('should render pending status badge', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'pending',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/Pendiente/)).toBeInTheDocument();
        });
    });

    it('should render overdue status badge', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'overdue',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/Vencido/)).toBeInTheDocument();
        });
    });

    it('should show pay button for unpaid invoices', async () => {
        const mockOnPayInvoice = vi.fn();
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'pending',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection onPayInvoice={mockOnPayInvoice} />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Pagar/ })).toBeInTheDocument();
        });
    });

    it('should not show pay button for paid invoices', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'paid',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/Test Invoice/)).toBeInTheDocument();
        });

        expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
    });

    it('should call onPayInvoice callback when pay button clicked', async () => {
        const mockOnPayInvoice = vi.fn();
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'pending',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection onPayInvoice={mockOnPayInvoice} />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Pagar/ })).toBeInTheDocument();
        });

        const payButton = screen.getByRole('button', { name: /Pagar/ });
        fireEvent.click(payButton);

        expect(mockOnPayInvoice).toHaveBeenCalledWith('inv_1', 10000);
    });

    it('should show download button for all invoices', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 10000,
                currency: 'ARS',
                status: 'paid',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /Descargar/ })).toBeInTheDocument();
        });
    });

    it('should format invoice amount in ARS', async () => {
        const mockInvoices = [
            {
                id: 'inv_1',
                createdAt: '2026-01-15T10:00:00Z',
                description: 'Test Invoice',
                amount: 12345.67,
                currency: 'ARS',
                status: 'paid',
                pdfUrl: 'https://example.com/invoice1.pdf'
            }
        ];

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/12\.345,67/)).toBeInTheDocument();
        });
    });

    it('should render empty state when no invoices', async () => {
        mockUseInvoices.mockReturnValue({
            data: [] as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByText(/No hay facturas disponibles aún/)).toBeInTheDocument();
        });
    });

    it('should render error state on fetch failure', async () => {
        mockUseInvoices.mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('Network error'),
            refetch: vi.fn()
        });

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('should retry fetching on error state retry button click', async () => {
        const mockRefetch = vi.fn();
        mockUseInvoices.mockReturnValue({
            data: null,
            isLoading: false,
            error: new Error('Network error'),
            refetch: mockRefetch
        } as any);

        render(<InvoiceListSection />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /Reintentar/ });
        fireEvent.click(retryButton);

        expect(mockRefetch).toHaveBeenCalled();
    });

    it('should respect limit prop', async () => {
        const mockInvoices = Array.from({ length: 20 }, (_, i) => ({
            id: `inv_${i}`,
            createdAt: '2026-01-15T10:00:00Z',
            description: `Invoice ${i}`,
            amount: 10000,
            currency: 'ARS',
            status: 'paid',
            pdfUrl: 'https://example.com/invoice.pdf'
        }));

        mockUseInvoices.mockReturnValue({
            data: mockInvoices as any,
            isLoading: false,
            error: null,
            refetch: vi.fn()
        } as any);

        render(<InvoiceListSection limit={5} />);

        await waitFor(() => {
            expect(mockUseInvoices).toHaveBeenCalled();
        });
    });
});
