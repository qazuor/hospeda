/**
 * SubscriptionPaymentHistoryBlock
 *
 * Renders the payment-history section inside SubscriptionDetailsDialog.
 * Extracted to keep the parent under 500 lines (SPEC-262 T-011).
 *
 * @module features/billing-subscriptions/SubscriptionPaymentHistoryBlock
 */

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { PaymentHistory } from './types';
import { formatArs, formatDate } from './utils';

/**
 * Props for SubscriptionPaymentHistoryBlock
 */
export interface SubscriptionPaymentHistoryBlockProps {
    readonly paymentHistory: readonly PaymentHistory[];
    readonly isLoading: boolean;
}

/**
 * Payment history table with loading and empty states.
 */
export function SubscriptionPaymentHistoryBlock({
    paymentHistory,
    isLoading
}: SubscriptionPaymentHistoryBlockProps) {
    const { t, locale } = useTranslations();

    return (
        <div>
            <h3 className="mb-2 font-medium text-sm">
                {t('admin-billing.subscriptions.paymentHistory.title')}
            </h3>
            {isLoading ? (
                <div className="rounded-md border p-6 text-center">
                    <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground text-xs">
                        {t('admin-billing.subscriptions.paymentHistory.loading')}
                    </p>
                </div>
            ) : paymentHistory.length === 0 ? (
                <div className="rounded-md border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                        {t('admin-billing.subscriptions.paymentHistory.empty')}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                        {t('admin-billing.subscriptions.paymentHistory.emptyHint')}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">
                                    {t('admin-billing.subscriptions.paymentHistory.dateColumn')}
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                    {t('admin-billing.subscriptions.paymentHistory.amountColumn')}
                                </th>
                                <th className="px-3 py-2 text-center font-medium">
                                    {t('admin-billing.subscriptions.paymentHistory.statusColumn')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentHistory.map((payment) => (
                                <tr
                                    key={payment.id}
                                    className="border-t"
                                >
                                    <td className="px-3 py-2">
                                        {formatDate(payment.date, locale)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatArs(payment.amount, locale)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <Badge
                                            variant={
                                                payment.status === 'paid'
                                                    ? 'default'
                                                    : payment.status === 'pending'
                                                      ? 'secondary'
                                                      : 'destructive'
                                            }
                                        >
                                            {payment.status === 'paid'
                                                ? t(
                                                      'admin-billing.subscriptions.paymentHistory.statusPaid'
                                                  )
                                                : payment.status === 'pending'
                                                  ? t(
                                                        'admin-billing.subscriptions.paymentHistory.statusPending'
                                                    )
                                                  : t(
                                                        'admin-billing.subscriptions.paymentHistory.statusFailed'
                                                    )}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
