import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { PaymentItem } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the PaymentHistory component
 */
export interface PaymentHistoryProps {
    /** Locale for i18n and date/currency formatting */
    readonly locale: SupportedLocale;
}

/**
 * Payment history table for the user billing dashboard.
 * Fetches payments on mount and displays date, amount, method and status.
 *
 * @example
 * ```tsx
 * <PaymentHistory locale="es" />
 * ```
 */
export function PaymentHistory({ locale }: PaymentHistoryProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [payments, setPayments] = useState<PaymentItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    /** Fetch payments from the API */
    const fetchPayments = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const result = await billingApi.getPayments({ pageSize: 50 });
            if (result.ok && result.data) {
                setPayments([...result.data.items]);
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
        fetchPayments();
    }, [fetchPayments]);

    /** Format a date string for display */
    const formatPaymentDate = (dateStr: string): string => {
        return formatDate({
            date: dateStr,
            locale: toBcp47Locale(locale),
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    };

    return (
        <section aria-labelledby="payments-heading">
            <h2
                id="payments-heading"
                className="mb-4 font-semibold text-lg text-text"
            >
                {t('subscription.paymentsTitle')}
            </h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div
                    className="space-y-2"
                    aria-busy="true"
                    aria-label={t('subscription.loading')}
                >
                    {(['sk-pay-0', 'sk-pay-1', 'sk-pay-2', 'sk-pay-3'] as const).map((id) => (
                        <div
                            key={id}
                            className="h-12 animate-pulse rounded-md bg-surface-alt"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-sm text-text-secondary">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchPayments}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        {t('subscription.retry')}
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasError && payments.length === 0 && (
                <div className="rounded-lg border border-border p-8 text-center">
                    <p className="text-sm text-text-secondary">{t('subscription.paymentsEmpty')}</p>
                </div>
            )}

            {/* Payments table */}
            {!isLoading && !hasError && payments.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table
                        className="w-full min-w-[520px] text-sm"
                        aria-label={t('subscription.paymentsTitle')}
                    >
                        <thead className="bg-surface-alt">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-left font-medium text-text-secondary text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.paymentDate')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-right font-medium text-text-secondary text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.paymentAmount')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-left font-medium text-text-secondary text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.paymentMethod')}
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-center font-medium text-text-secondary text-xs uppercase tracking-wide"
                                >
                                    {t('subscription.paymentStatus')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {payments.map((payment) => (
                                <tr
                                    key={payment.id}
                                    className="bg-surface transition-colors hover:bg-surface-alt"
                                >
                                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                                        {formatPaymentDate(payment.date)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-text tabular-nums">
                                        {formatCurrency({
                                            value: payment.amount / 100,
                                            currency: payment.currency,
                                            locale: toBcp47Locale(locale)
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-text-secondary">
                                        {payment.method}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center rounded-full bg-surface-alt px-2.5 py-0.5 font-medium text-text-secondary text-xs capitalize">
                                            {payment.status}
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
