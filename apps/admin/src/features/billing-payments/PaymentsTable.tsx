import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { Payment } from './types';
import {
    formatArs,
    formatDate,
    getPaymentMethodLabel,
    getStatusLabel,
    getStatusVariant
} from './utils';

/**
 * Props for PaymentsTable
 */
export interface PaymentsTableProps {
    readonly payments: Payment[];
    readonly isLoading: boolean;
    readonly isError: boolean;
    readonly onViewDetails: (payment: Payment) => void;
    readonly onRefund: (payment: Payment) => void;
}

/**
 * Payments table component.
 * Renders the list of payments with status badges, method labels, and action buttons.
 */
export function PaymentsTable({
    payments,
    isLoading,
    isError,
    onViewDetails,
    onRefund
}: PaymentsTableProps) {
    const { t, tPlural, locale } = useTranslations();

    const cardDescription = isLoading
        ? t('admin-billing.payments.loadingPayments')
        : isError
          ? t('admin-billing.payments.errorLoading')
          : payments.length === 0
            ? t('admin-billing.payments.noPayments')
            : tPlural('admin-billing.payments.paymentCount', payments.length);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-billing.payments.tableTitle')}</CardTitle>
                <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-12 text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground text-sm">
                            {t('admin-billing.payments.loadingPayments')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-12 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-billing.payments.errorLoading')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.payments.apiCheckError')}
                        </p>
                    </div>
                ) : payments.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.payments.emptyTitle')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.payments.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.payments.columns.id')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.payments.columns.user')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.payments.columns.amount')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('admin-billing.payments.columns.status')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.payments.columns.date')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.payments.columns.method')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.payments.columns.plan')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.payments.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((payment: Payment) => (
                                    <tr
                                        key={payment.id}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {payment.id.slice(0, 8)}...
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <div className="font-medium">
                                                    {payment.userName}
                                                </div>
                                                <div className="text-muted-foreground text-xs">
                                                    {payment.userEmail}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatArs(payment.amount, locale)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant={getStatusVariant(payment.status)}>
                                                {getStatusLabel(payment.status, t)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {formatDate(payment.date, locale)}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {getPaymentMethodLabel(payment.method, t)}
                                        </td>
                                        <td className="px-4 py-3 text-xs">{payment.planName}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onViewDetails(payment)}
                                                >
                                                    {t('admin-billing.payments.viewButton')}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onRefund(payment)}
                                                    disabled={payment.status !== 'completed'}
                                                    title={
                                                        payment.status !== 'completed'
                                                            ? t(
                                                                  'admin-billing.payments.refundDisabledTitle'
                                                              )
                                                            : t(
                                                                  'admin-billing.payments.refundEnabledTitle'
                                                              )
                                                    }
                                                >
                                                    {t('admin-billing.payments.refundButton')}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
