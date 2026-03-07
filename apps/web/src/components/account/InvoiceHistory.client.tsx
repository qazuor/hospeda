import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { InvoiceItem } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the InvoiceHistory component.
 */
export interface InvoiceHistoryProps {
    /** Locale for i18n and date/currency formatting */
    readonly locale: SupportedLocale;
}

/** Status badge styling map using semantic design-system tokens */
const STATUS_STYLES: Readonly<Record<InvoiceItem['status'], string>> = {
    paid: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    overdue: 'bg-destructive/10 text-destructive',
    void: 'bg-muted text-muted-foreground'
} as const;

/** Status translation key map */
const STATUS_KEYS: Readonly<Record<InvoiceItem['status'], string>> = {
    paid: 'subscription.invoiceStatusPaid',
    pending: 'subscription.invoiceStatusPending',
    overdue: 'subscription.invoiceStatusOverdue',
    void: 'subscription.invoiceStatusVoid'
} as const;

/**
 * Invoice history table for the user billing dashboard.
 * Fetches invoices on mount and displays them in a table with status badges.
 * Handles loading, error, and empty states gracefully.
 *
 * @param props - {@link InvoiceHistoryProps}
 *
 * @example
 * ```tsx
 * <InvoiceHistory locale="es" />
 * ```
 */
export function InvoiceHistory({ locale }: InvoiceHistoryProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    /** Fetch invoices from the protected billing API */
    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const result = await billingApi.getInvoices({ pageSize: 50 });
            if (result.ok && result.data) {
                setInvoices([...result.data.items]);
            } else {
                setHasError(true);
            }
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    /**
     * Format a date string for display using @repo/i18n's formatDate.
     *
     * @param dateStr - ISO 8601 date string
     * @returns Localized short date string (e.g. "12 mar. 2025")
     */
    const formatInvoiceDate = (dateStr: string): string => {
        return formatDate({
            date: dateStr,
            locale: toBcp47Locale(locale),
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    };

    return (
        <section aria-labelledby="invoices-heading">
            <h2
                id="invoices-heading"
                className="mb-4 font-semibold text-foreground text-lg"
            >
                {t('subscription.invoicesTitle')}
            </h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div
                    className="space-y-2"
                    aria-busy="true"
                    aria-label={t('subscription.loading')}
                >
                    {(['sk-inv-0', 'sk-inv-1', 'sk-inv-2', 'sk-inv-3'] as const).map((id) => (
                        <div
                            key={id}
                            className="h-12 animate-pulse rounded-md bg-muted"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-muted-foreground text-sm">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchInvoices}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('subscription.retry')}
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasError && invoices.length === 0 && (
                <div className="rounded-lg border border-border p-8 text-center">
                    <p className="text-muted-foreground text-sm">
                        {t('subscription.invoicesEmpty')}
                    </p>
                </div>
            )}

            {/* Invoice table */}
            {!isLoading && !hasError && invoices.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table
                        className="w-full min-w-[600px] text-sm"
                        aria-label={t('subscription.invoicesTitle')}
                    >
                        <thead className="bg-muted">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.invoiceDate')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.invoiceDescription')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.invoiceAmount')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-center font-medium text-muted-foreground text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.invoiceStatus')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {invoices.map((invoice) => (
                                <tr
                                    key={invoice.id}
                                    className="bg-card transition-colors hover:bg-muted"
                                >
                                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                        {formatInvoiceDate(invoice.date)}
                                    </td>
                                    <td className="px-4 py-3 text-foreground">
                                        {invoice.description}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-foreground tabular-nums">
                                        {formatCurrency({
                                            value: invoice.amount / 100,
                                            currency: invoice.currency,
                                            locale: toBcp47Locale(locale)
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_STYLES[invoice.status]}`}
                                        >
                                            {t(STATUS_KEYS[invoice.status])}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
