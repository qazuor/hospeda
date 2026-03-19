/**
 * InvoiceDetailDialog Integration Tests
 *
 * Tests for the read-only invoice detail modal dialog including
 * data rendering, action buttons, and null-invoice handling.
 *
 * @module test/integration/invoice-detail-dialog
 */

import { InvoiceDetailDialog } from '@/features/billing-invoices/components/InvoiceDetailDialog';
import type { Invoice } from '@/features/billing-invoices/components/InvoiceDetailDialog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockBillingInvoice, mockBillingInvoiceList } from '../fixtures/billing-invoice.fixture';
import { renderWithProviders } from '../helpers/render-with-providers';

/** Cast fixture to mutable Invoice type for component props */
function asInvoice(fixture: typeof mockBillingInvoice): Invoice {
    return {
        ...fixture,
        lineItems: fixture.lineItems.map((li) => ({ ...li }))
    } as Invoice;
}

describe('InvoiceDetailDialog', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        onMarkAsPaid: vi.fn(),
        onMarkAsVoid: vi.fn(),
        onSendReminder: vi.fn()
    };

    describe('renders invoice data correctly', () => {
        it('displays invoice number in the dialog title', () => {
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                />
            );

            expect(screen.getByText(invoice.invoiceNumber, { exact: false })).toBeInTheDocument();
        });

        it('displays client name and email', () => {
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                />
            );

            expect(screen.getByText(invoice.userName)).toBeInTheDocument();
            expect(screen.getByText(invoice.userEmail)).toBeInTheDocument();
        });

        it('displays line item descriptions and quantities', () => {
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                />
            );

            for (const item of invoice.lineItems) {
                expect(screen.getByText(item.description)).toBeInTheDocument();
                expect(screen.getByText(String(item.quantity))).toBeInTheDocument();
            }
        });

        it('displays status badge with translated label', () => {
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                />
            );

            // Translation mock returns keys as-is
            expect(
                screen.getByText(`admin-billing.invoices.statuses.${invoice.status}`)
            ).toBeInTheDocument();
        });

        it('displays totals section labels', () => {
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                />
            );

            expect(screen.getByText('admin-billing.invoices.dialog.subtotal')).toBeInTheDocument();
            expect(screen.getByText('admin-billing.invoices.dialog.tax')).toBeInTheDocument();
            expect(screen.getByText('admin-billing.invoices.dialog.total')).toBeInTheDocument();
        });

        it('displays notes section when invoice has notes', () => {
            const voidInvoice = asInvoice(
                mockBillingInvoiceList[2] as unknown as typeof mockBillingInvoice
            );

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={voidInvoice}
                />
            );

            expect(screen.getByText('Subscription cancelled before payment')).toBeInTheDocument();
        });

        it('displays payment info section for paid invoices', () => {
            const paidInvoice = asInvoice(
                mockBillingInvoiceList[1] as unknown as typeof mockBillingInvoice
            );

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={paidInvoice}
                />
            );

            expect(screen.getByText(/MercadoPago/)).toBeInTheDocument();
        });
    });

    describe('action buttons', () => {
        it('calls onMarkAsPaid when mark-as-paid button is clicked', async () => {
            const user = userEvent.setup();
            const onMarkAsPaid = vi.fn();
            const invoice = asInvoice(mockBillingInvoice); // status: 'open'

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                    onMarkAsPaid={onMarkAsPaid}
                />
            );

            const markAsPaidButton = screen.getByText('admin-billing.invoices.dialog.markAsPaid');
            await user.click(markAsPaidButton);

            expect(onMarkAsPaid).toHaveBeenCalledOnce();
            expect(onMarkAsPaid).toHaveBeenCalledWith(invoice);
        });

        it('calls onMarkAsVoid when void button is clicked', async () => {
            const user = userEvent.setup();
            const onMarkAsVoid = vi.fn();
            const invoice = asInvoice(mockBillingInvoice); // status: 'open'

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                    onMarkAsVoid={onMarkAsVoid}
                />
            );

            const voidButton = screen.getByText('admin-billing.invoices.dialog.voidInvoice');
            await user.click(voidButton);

            expect(onMarkAsVoid).toHaveBeenCalledOnce();
            expect(onMarkAsVoid).toHaveBeenCalledWith(invoice);
        });

        it('calls onSendReminder when reminder button is clicked', async () => {
            const user = userEvent.setup();
            const onSendReminder = vi.fn();
            const invoice = asInvoice(mockBillingInvoice); // status: 'open'

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                    onSendReminder={onSendReminder}
                />
            );

            const reminderButton = screen.getByText('admin-billing.invoices.dialog.sendReminder');
            await user.click(reminderButton);

            expect(onSendReminder).toHaveBeenCalledOnce();
            expect(onSendReminder).toHaveBeenCalledWith(invoice);
        });

        it('hides mark-as-paid and send-reminder for paid invoices', () => {
            const paidInvoice = asInvoice(
                mockBillingInvoiceList[1] as unknown as typeof mockBillingInvoice
            );

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={paidInvoice}
                />
            );

            expect(
                screen.queryByText('admin-billing.invoices.dialog.markAsPaid')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('admin-billing.invoices.dialog.sendReminder')
            ).not.toBeInTheDocument();
        });

        it('calls onOpenChange(false) when close button is clicked', async () => {
            const user = userEvent.setup();
            const onOpenChange = vi.fn();
            const invoice = asInvoice(mockBillingInvoice);

            renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={invoice}
                    onOpenChange={onOpenChange}
                />
            );

            const closeButton = screen.getByText('admin-billing.common.close');
            await user.click(closeButton);

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('null invoice handling', () => {
        it('renders nothing when invoice is null', () => {
            const { container } = renderWithProviders(
                <InvoiceDetailDialog
                    {...defaultProps}
                    invoice={null}
                />
            );

            // Dialog should not be rendered at all
            expect(
                screen.queryByText('admin-billing.invoices.dialog.invoicePrefix')
            ).not.toBeInTheDocument();
            // Container should be empty (only the wrapping providers)
            expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
        });
    });
});
