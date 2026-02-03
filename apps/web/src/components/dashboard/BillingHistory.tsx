/**
 * BillingHistory Component
 *
 * Displays chronological list of invoices using useInvoices() from @qazuor/qzpay-react.
 * Shows invoice date, amount, status, and download link.
 *
 * @module components/dashboard/BillingHistory
 */

'use client';

import type { QZPayInvoice } from '@qazuor/qzpay-core';
import { useInvoices } from '@qazuor/qzpay-react';

/**
 * Format currency amount to ARS format
 *
 * @param amount - Amount in cents
 * @returns Formatted currency string
 */
function formatCurrency(amount: number): string {
    const amountInPesos = amount / 100;
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amountInPesos);
}

/**
 * Format date to es-AR locale
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted date string
 */
function formatDate(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

/**
 * Get status badge configuration
 *
 * @param status - Invoice status
 * @returns Badge configuration with label and color classes
 */
function getStatusBadge(status: QZPayInvoice['status']): {
    label: string;
    colorClass: string;
    bgColorClass: string;
} {
    switch (status) {
        case 'paid':
            return {
                label: 'Pagada',
                colorClass: 'text-green-700',
                bgColorClass: 'bg-green-100'
            };
        case 'open':
            return {
                label: 'Pendiente',
                colorClass: 'text-yellow-700',
                bgColorClass: 'bg-yellow-100'
            };
        case 'uncollectible':
            return {
                label: 'Incobrable',
                colorClass: 'text-red-700',
                bgColorClass: 'bg-red-100'
            };
        case 'void':
            return {
                label: 'Anulada',
                colorClass: 'text-gray-700',
                bgColorClass: 'bg-gray-100'
            };
        case 'draft':
            return {
                label: 'Borrador',
                colorClass: 'text-gray-600',
                bgColorClass: 'bg-gray-50'
            };
        default:
            return {
                label: status,
                colorClass: 'text-gray-700',
                bgColorClass: 'bg-gray-100'
            };
    }
}

/**
 * LoadingSkeleton Component
 *
 * Displays a loading skeleton matching the table layout
 */
function LoadingSkeleton() {
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Historial de Facturación</h2>
            <div
                className="animate-pulse"
                // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                role="status"
                aria-busy="true"
                aria-label="Cargando historial de facturación"
            >
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex gap-4"
                        >
                            <div className="h-12 flex-1 rounded bg-gray-200" />
                            <div className="h-12 w-32 rounded bg-gray-200" />
                            <div className="h-12 w-24 rounded bg-gray-200" />
                            <div className="h-12 w-20 rounded bg-gray-200" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * ErrorState Component
 *
 * Displays error state with retry button
 */
function ErrorState(props: { onRetry: () => void }) {
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Historial de Facturación</h2>
            <div
                className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
                role="alert"
            >
                <svg
                    className="mx-auto mb-3 h-12 w-12 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <title>Error</title>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="mb-4 text-red-700">No pudimos cargar el historial de facturación</p>
                <button
                    type="button"
                    onClick={props.onRetry}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Reintentar
                </button>
            </div>
        </div>
    );
}

/**
 * EmptyState Component
 *
 * Displays empty state when there are no invoices
 */
function EmptyState() {
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Historial de Facturación</h2>
            <div className="py-12 text-center">
                <svg
                    className="mx-auto mb-4 h-16 w-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <title>Sin facturas</title>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
                <h3 className="mb-2 font-bold text-gray-900 text-xl">Sin facturas</h3>
                <p className="text-gray-600">No hay facturas disponibles</p>
            </div>
        </div>
    );
}

/**
 * Get invoice download URL from provider IDs
 *
 * @param invoice - Invoice with provider IDs
 * @returns Download URL or null
 */
function getInvoiceUrl(invoice: QZPayInvoice): string | null {
    // Check if we have a Mercado Pago invoice URL in metadata
    if (invoice.metadata?.invoiceUrl && typeof invoice.metadata.invoiceUrl === 'string') {
        return invoice.metadata.invoiceUrl;
    }

    // Check for provider-specific invoice IDs that could be used to construct URLs
    // This is a placeholder - actual implementation depends on provider integration
    if (invoice.providerInvoiceIds?.mercadopago) {
        // In production, this would link to the actual Mercado Pago invoice
        return null; // Return null for now since we don't have the actual URL format
    }

    return null;
}

/**
 * InvoiceTable Component
 *
 * Displays table of invoices
 */
function InvoiceTable(props: { invoices: QZPayInvoice[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th
                            scope="col"
                            className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                        >
                            Fecha
                        </th>
                        <th
                            scope="col"
                            className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                        >
                            Monto
                        </th>
                        <th
                            scope="col"
                            className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                        >
                            Estado
                        </th>
                        <th
                            scope="col"
                            className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                        >
                            Acción
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {props.invoices.map((invoice) => {
                        const statusBadge = getStatusBadge(invoice.status);
                        const date = invoice.paidAt || invoice.dueDate || invoice.createdAt;
                        const invoiceUrl = getInvoiceUrl(invoice);

                        return (
                            <tr
                                key={invoice.id}
                                className="hover:bg-gray-50"
                            >
                                <td className="whitespace-nowrap px-6 py-4 text-gray-900 text-sm">
                                    {formatDate(date)}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900 text-sm">
                                    {formatCurrency(invoice.total)}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                    <span
                                        className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-xs ${statusBadge.colorClass} ${statusBadge.bgColorClass}`}
                                    >
                                        {statusBadge.label}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                    {invoiceUrl ? (
                                        <a
                                            href={invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <title>Descargar</title>
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            Descargar
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/**
 * BillingHistory Component
 *
 * Main component that manages invoice data fetching and rendering.
 * Uses useInvoices() hook from @qazuor/qzpay-react.
 *
 * @returns React element displaying billing history
 *
 * @example
 * ```tsx
 * import { BillingHistory } from '@/components/dashboard';
 *
 * <BillingHistory />
 * ```
 */
export function BillingHistory() {
    // Fetch invoices using qzpay-react hook
    const { data, isLoading, error, refetch } = useInvoices();

    // Loading state
    if (isLoading) {
        return <LoadingSkeleton />;
    }

    // Error state
    if (error) {
        return <ErrorState onRetry={() => void refetch()} />;
    }

    // Empty state
    if (!data || data.length === 0) {
        return <EmptyState />;
    }

    // Success state with invoices
    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Historial de Facturación</h2>
            <InvoiceTable invoices={data} />
        </div>
    );
}
