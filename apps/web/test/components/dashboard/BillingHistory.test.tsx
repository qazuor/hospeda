/**
 * BillingHistory Component Tests
 *
 * Tests all states and functionality of the BillingHistory component
 */

import type { QZPayInvoice } from '@qazuor/qzpay-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingHistory } from '../../../src/components/dashboard/BillingHistory';

// Mock @qazuor/qzpay-react
vi.mock('@qazuor/qzpay-react', () => ({
    useInvoices: vi.fn()
}));

// Import after mocking
import { useInvoices } from '@qazuor/qzpay-react';

describe('BillingHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Factory function to create mock invoices with required fields
     */
    function createMockInvoice(overrides: Partial<QZPayInvoice> = {}): QZPayInvoice {
        return {
            id: overrides.id || 'inv_test123',
            customerId: overrides.customerId || 'cus_test123',
            subscriptionId:
                overrides.subscriptionId !== undefined ? overrides.subscriptionId : 'sub_test123',
            currency: overrides.currency || 'ARS',
            status: overrides.status || 'paid',
            subtotal: overrides.subtotal !== undefined ? overrides.subtotal : 1500000,
            tax: overrides.tax !== undefined ? overrides.tax : 0,
            discount: overrides.discount !== undefined ? overrides.discount : 0,
            total: overrides.total !== undefined ? overrides.total : 1500000, // 15000 ARS
            amountPaid: overrides.amountPaid !== undefined ? overrides.amountPaid : 1500000,
            amountDue: overrides.amountDue !== undefined ? overrides.amountDue : 0,
            paidAt: overrides.paidAt !== undefined ? overrides.paidAt : new Date('2026-02-01'),
            dueDate: overrides.dueDate !== undefined ? overrides.dueDate : new Date('2026-02-01'),
            voidedAt: overrides.voidedAt !== undefined ? overrides.voidedAt : null,
            periodStart:
                overrides.periodStart !== undefined
                    ? overrides.periodStart
                    : new Date('2026-01-01'),
            periodEnd:
                overrides.periodEnd !== undefined ? overrides.periodEnd : new Date('2026-01-31'),
            lines: overrides.lines || [],
            providerInvoiceIds: overrides.providerInvoiceIds || {},
            metadata: overrides.metadata || {},
            livemode: overrides.livemode !== undefined ? overrides.livemode : false,
            createdAt: overrides.createdAt || new Date('2026-01-15'),
            updatedAt: overrides.updatedAt || new Date('2026-01-15')
        };
    }

    describe('Loading State', () => {
        it('should render loading skeleton when isLoading is true', () => {
            (useInvoices as Mock).mockReturnValue({
                data: null,
                isLoading: true,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            expect(screen.getByLabelText('Cargando historial de facturación')).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
            expect(screen.getByText('Historial de Facturación')).toBeInTheDocument();
        });
    });

    describe('Error State', () => {
        it('should render error message when error exists', () => {
            const mockRefetch = vi.fn();
            (useInvoices as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: new Error('Network error'),
                refetch: mockRefetch
            });

            render(<BillingHistory />);

            expect(
                screen.getByText('No pudimos cargar el historial de facturación')
            ).toBeInTheDocument();
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
        });

        it('should call refetch when retry button is clicked', async () => {
            const mockRefetch = vi.fn().mockResolvedValue(undefined);

            (useInvoices as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: new Error('Network error'),
                refetch: mockRefetch
            });

            render(<BillingHistory />);

            const retryButton = screen.getByRole('button', { name: /reintentar/i });
            fireEvent.click(retryButton);

            await waitFor(() => {
                expect(mockRefetch).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Empty State', () => {
        it('should render empty state when data is null', () => {
            (useInvoices as Mock).mockReturnValue({
                data: null,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            expect(screen.getByRole('heading', { name: /sin facturas/i })).toBeInTheDocument();
            expect(screen.getByText('No hay facturas disponibles')).toBeInTheDocument();
        });

        it('should render empty state when data is empty array', () => {
            (useInvoices as Mock).mockReturnValue({
                data: [],
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            expect(screen.getByRole('heading', { name: /sin facturas/i })).toBeInTheDocument();
            expect(screen.getByText('No hay facturas disponibles')).toBeInTheDocument();
        });
    });

    describe('Invoice List Rendering', () => {
        it('should render table with invoices', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    total: 1500000,
                    status: 'paid',
                    paidAt: new Date('2026-02-01')
                }),
                createMockInvoice({
                    id: 'inv_2',
                    total: 2000000,
                    status: 'open',
                    paidAt: new Date('2026-01-15')
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check header
            expect(screen.getByText('Historial de Facturación')).toBeInTheDocument();

            // Check table headers
            expect(screen.getByText('Fecha')).toBeInTheDocument();
            expect(screen.getByText('Monto')).toBeInTheDocument();
            expect(screen.getByText('Estado')).toBeInTheDocument();
            expect(screen.getByText('Acción')).toBeInTheDocument();

            // Check invoice data (amounts)
            expect(screen.getByText(/15\.000/i)).toBeInTheDocument();
            expect(screen.getByText(/20\.000/i)).toBeInTheDocument();
        });

        it('should render correct number of invoice rows', () => {
            const mockInvoices = [
                createMockInvoice({ id: 'inv_1' }),
                createMockInvoice({ id: 'inv_2' }),
                createMockInvoice({ id: 'inv_3' })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Get all table rows (excluding header row)
            const rows = screen.getAllByRole('row');
            // 1 header row + 3 data rows = 4 total
            expect(rows).toHaveLength(4);
        });

        it('should format dates correctly in es-AR locale', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    paidAt: new Date('2026-02-15T12:00:00Z')
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check for Spanish date format (flexible with day due to timezone)
            expect(screen.getByText(/febrero de 2026/i)).toBeInTheDocument();
        });

        it('should format amounts in ARS currency', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    total: 2599900, // 25999 ARS
                    currency: 'ARS'
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check for formatted price (allow for different formatting)
            expect(screen.getByText(/25\.999/i)).toBeInTheDocument();
        });
    });

    describe('Status Badges', () => {
        const statusTests: Array<{
            status: QZPayInvoice['status'];
            label: string;
            colorClass: string;
            bgClass: string;
        }> = [
            {
                status: 'paid',
                label: 'Pagada',
                colorClass: 'text-green-700',
                bgClass: 'bg-green-100'
            },
            {
                status: 'open',
                label: 'Pendiente',
                colorClass: 'text-yellow-700',
                bgClass: 'bg-yellow-100'
            },
            {
                status: 'uncollectible',
                label: 'Incobrable',
                colorClass: 'text-red-700',
                bgClass: 'bg-red-100'
            },
            {
                status: 'void',
                label: 'Anulada',
                colorClass: 'text-gray-700',
                bgClass: 'bg-gray-100'
            },
            {
                status: 'draft',
                label: 'Borrador',
                colorClass: 'text-gray-600',
                bgClass: 'bg-gray-50'
            }
        ];

        // biome-ignore lint/complexity/noForEach: describe.each not available in this context
        statusTests.forEach(({ status, label, colorClass, bgClass }) => {
            it(`should render correct badge for ${status} status`, () => {
                const mockInvoices = [
                    createMockInvoice({
                        id: 'inv_test',
                        status
                    })
                ];

                (useInvoices as Mock).mockReturnValue({
                    data: mockInvoices,
                    isLoading: false,
                    error: null,
                    refetch: vi.fn()
                });

                render(<BillingHistory />);

                const badge = screen.getByText(label);
                expect(badge).toBeInTheDocument();
                expect(badge).toHaveClass(colorClass);
                expect(badge).toHaveClass(bgClass);
            });
        });
    });

    describe('Download Link', () => {
        it('should render download link when invoiceUrl is in metadata', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    metadata: {
                        invoiceUrl: 'https://example.com/invoice_123.pdf'
                    }
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            const downloadLink = screen.getByRole('link', { name: /descargar/i });
            expect(downloadLink).toBeInTheDocument();
            expect(downloadLink).toHaveAttribute('href', 'https://example.com/invoice_123.pdf');
            expect(downloadLink).toHaveAttribute('target', '_blank');
            expect(downloadLink).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('should not render download link when metadata has no invoiceUrl', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    metadata: {}
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            const downloadLink = screen.queryByRole('link', { name: /descargar/i });
            expect(downloadLink).not.toBeInTheDocument();
            // Should show dash placeholder
            expect(screen.getByText('-')).toBeInTheDocument();
        });

        it('should not render download link when metadata is empty', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    metadata: {}
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            const downloadLink = screen.queryByRole('link', { name: /descargar/i });
            expect(downloadLink).not.toBeInTheDocument();
        });
    });

    describe('Date Priority', () => {
        it('should use paidAt when available', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    paidAt: new Date('2026-02-15T12:00:00Z'),
                    dueDate: new Date('2026-01-01T12:00:00Z'),
                    createdAt: new Date('2025-12-01T12:00:00Z')
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check that February 2026 date is rendered (be flexible with day due to timezone)
            expect(screen.getByText(/febrero de 2026/i)).toBeInTheDocument();
        });

        it('should fallback to dueDate when paidAt is null', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    paidAt: null,
                    dueDate: new Date('2026-01-20T12:00:00Z'),
                    createdAt: new Date('2025-12-01T12:00:00Z')
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check that January 2026 date is rendered (be flexible with day due to timezone)
            expect(screen.getByText(/enero de 2026/i)).toBeInTheDocument();
        });

        it('should fallback to createdAt when both paidAt and dueDate are null', () => {
            const mockInvoices = [
                createMockInvoice({
                    id: 'inv_1',
                    paidAt: null,
                    dueDate: null,
                    createdAt: new Date('2025-12-10T12:00:00Z')
                })
            ];

            (useInvoices as Mock).mockReturnValue({
                data: mockInvoices,
                isLoading: false,
                error: null,
                refetch: vi.fn()
            });

            render(<BillingHistory />);

            // Check that December 2025 date is rendered (be flexible with day due to timezone)
            expect(screen.getByText(/diciembre de 2025/i)).toBeInTheDocument();
        });
    });
});
