/**
 * InvoiceListSection Component
 *
 * Displays recent invoices with pay and download actions
 *
 * @module components/billing/InvoiceListSection
 */

'use client';

import { useInvoices } from '@qazuor/qzpay-react';
import { useTranslations } from '@repo/i18n';
import { BillingEmptyState } from './BillingEmptyState';
import { BillingErrorState } from './BillingErrorState';

/**
 * Invoice data structure
 */
interface Invoice {
    id: string;
    createdAt: string;
    description: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'overdue';
    pdfUrl: string;
}

/**
 * Props for the InvoiceListSection component
 */
export interface InvoiceListSectionProps {
    /**
     * Optional customer ID filter
     */
    customerId?: string;

    /**
     * Number of invoices to display
     * @default 10
     */
    limit?: number;

    /**
     * Callback when pay button is clicked
     * Receives invoice ID and amount
     */
    onPayInvoice?: (invoiceId: string, amount: number) => void;
}

/**
 * Format date in Spanish locale
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

/**
 * Format currency in ARS locale
 */
function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * Status badge class names by status
 */
const STATUS_CLASSES: Record<Invoice['status'], string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700'
};

/**
 * InvoiceListSection Component
 *
 * Displays user's invoices in a table with actions.
 * Fetches invoices from QZPay API, displays in table format
 * with status badges and pay/download actions.
 *
 * Features:
 * - Fetches invoices using useInvoices hook
 * - Displays table with date, description, amount, status
 * - Status badges (Paid/Pending/Overdue)
 * - Pay button for unpaid invoices
 * - Download button for all invoices
 * - Loading skeleton states
 * - Empty state when no invoices
 * - Error state with retry
 *
 * @param props - Component props
 * @returns React element displaying invoices section
 *
 * @example
 * ```tsx
 * <InvoiceListSection
 *   limit={10}
 *   onPayInvoice={(id, amount) => setPaymentDialog({ id, amount })}
 * />
 * ```
 */
export function InvoiceListSection({
    customerId: _customerId,
    limit = 10,
    onPayInvoice
}: InvoiceListSectionProps) {
    const { data, isLoading, error, refetch } = useInvoices();
    const { t } = useTranslations();

    // Loading state
    if (isLoading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.invoices.title')}
                </h2>
                <div
                    className="flex items-center justify-center py-12"
                    // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.invoices.title')}
                </h2>
                <BillingErrorState
                    title={t('billing.invoices.error.loadTitle')}
                    message={error.message || t('billing.invoices.error.loadFallback')}
                    onRetry={refetch}
                />
            </div>
        );
    }

    const invoices = (data as unknown as Invoice[] | undefined) || [];

    // Empty state
    if (invoices.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.invoices.title')}
                </h2>
                <BillingEmptyState
                    title={t('billing.invoices.empty.title')}
                    description={t('billing.invoices.empty.description')}
                    icon={
                        <svg
                            className="h-16 w-16 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    }
                />
            </div>
        );
    }

    // Invoices table
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">{t('billing.invoices.title')}</h2>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-gray-200 border-b">
                            <th className="pr-4 pb-3 text-left font-semibold text-gray-700 text-sm">
                                {t('billing.invoices.columns.date')}
                            </th>
                            <th className="px-4 pb-3 text-left font-semibold text-gray-700 text-sm">
                                {t('billing.invoices.columns.description')}
                            </th>
                            <th className="px-4 pb-3 text-right font-semibold text-gray-700 text-sm">
                                {t('billing.invoices.columns.amount')}
                            </th>
                            <th className="px-4 pb-3 text-center font-semibold text-gray-700 text-sm">
                                {t('billing.invoices.columns.status')}
                            </th>
                            <th className="pb-3 pl-4 text-right font-semibold text-gray-700 text-sm">
                                {t('billing.invoices.columns.actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {invoices.map((invoice) => {
                            const statusClass = STATUS_CLASSES[invoice.status];
                            const isPaid = invoice.status === 'paid';

                            return (
                                <tr
                                    key={invoice.id}
                                    className="hover:bg-gray-50"
                                >
                                    {/* Date */}
                                    <td className="py-4 pr-4 text-gray-900 text-sm">
                                        {formatDate(invoice.createdAt)}
                                    </td>

                                    {/* Description */}
                                    <td className="px-4 py-4 text-gray-900 text-sm">
                                        {invoice.description}
                                    </td>

                                    {/* Amount */}
                                    <td className="px-4 py-4 text-right font-semibold text-gray-900 text-sm">
                                        {formatCurrency(invoice.amount, invoice.currency)}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-4 text-center">
                                        <span
                                            className={`inline-block rounded-full px-3 py-1 font-medium text-xs ${statusClass}`}
                                        >
                                            {t(`billing.invoices.status.${invoice.status}`)}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="py-4 pl-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Pay button (only for unpaid) */}
                                            {!isPaid && onPayInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onPayInvoice(invoice.id, invoice.amount)
                                                    }
                                                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700"
                                                    aria-label={t('billing.invoices.pay')}
                                                >
                                                    {t('billing.invoices.pay')}
                                                </button>
                                            )}

                                            {/* Download button */}
                                            <a
                                                href={invoice.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50"
                                                aria-label={t('billing.invoices.download')}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                    />
                                                </svg>
                                                {t('billing.invoices.download')}
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Total count */}
            {Array.isArray(data) && data.length > limit && (
                <div className="mt-4 text-center text-gray-600 text-sm">
                    {t('billing.invoices.showingOf', {
                        limit: String(limit),
                        total: String(data.length)
                    })}
                </div>
            )}
        </div>
    );
}
