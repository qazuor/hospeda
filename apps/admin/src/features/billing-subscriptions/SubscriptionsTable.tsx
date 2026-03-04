import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { Subscription } from './types';
import { formatArs, formatDate, getPlanBySlug, getStatusLabel, getStatusVariant } from './utils';

/**
 * Props for SubscriptionsTable
 */
export interface SubscriptionsTableProps {
    readonly subscriptions: Subscription[];
    readonly isLoading: boolean;
    readonly isError: boolean;
    readonly onViewDetails: (subscription: Subscription) => void;
    readonly onCancel: (subscription: Subscription) => void;
}

/**
 * Subscriptions table component.
 * Renders the paginated list of subscriptions with status badges and action buttons.
 */
export function SubscriptionsTable({
    subscriptions,
    isLoading,
    isError,
    onViewDetails,
    onCancel
}: SubscriptionsTableProps) {
    const { t, tPlural, locale } = useTranslations();

    const cardDescription = isLoading
        ? t('admin-billing.subscriptions.loadingSubscriptions')
        : isError
          ? t('admin-billing.subscriptions.errorLoading')
          : subscriptions.length === 0
            ? t('admin-billing.subscriptions.noSubscriptions')
            : tPlural('admin-billing.subscriptions.subscriptionCount', subscriptions.length);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-billing.subscriptions.tableTitle')}</CardTitle>
                <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-12 text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground text-sm">
                            {t('admin-billing.subscriptions.loadingSubscriptions')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-12 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-billing.subscriptions.errorLoading')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.subscriptions.apiCheckError')}
                        </p>
                    </div>
                ) : subscriptions.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.subscriptions.emptyTitle')}
                        </p>
                        <p className="mt-2 text-muted-foreground text-xs">
                            {t('admin-billing.subscriptions.emptyHint')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.subscriptions.columns.user')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.subscriptions.columns.plan')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('admin-billing.subscriptions.columns.status')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.subscriptions.columns.startDate')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('admin-billing.subscriptions.columns.periodEnd')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.subscriptions.columns.monthlyAmount')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('admin-billing.subscriptions.columns.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {subscriptions.map((subscription: Subscription) => {
                                    const plan = getPlanBySlug(subscription.planSlug);
                                    return (
                                        <tr
                                            key={subscription.id}
                                            className="border-b hover:bg-muted/50"
                                        >
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-medium">
                                                        {subscription.userName}
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {subscription.userEmail}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-medium">{plan?.name}</div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {plan?.category === 'owner'
                                                            ? t(
                                                                  'admin-billing.subscriptions.categoryOwner'
                                                              )
                                                            : plan?.category === 'complex'
                                                              ? t(
                                                                    'admin-billing.subscriptions.categoryComplex'
                                                                )
                                                              : t(
                                                                    'admin-billing.subscriptions.categoryTourist'
                                                                )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant={getStatusVariant(subscription.status)}
                                                >
                                                    {getStatusLabel(subscription.status, t)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {formatDate(subscription.startDate, locale)}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                                {formatDate(subscription.currentPeriodEnd, locale)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {formatArs(subscription.monthlyAmount, locale)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onViewDetails(subscription)}
                                                    >
                                                        {t(
                                                            'admin-billing.subscriptions.viewButton'
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onCancel(subscription)}
                                                    >
                                                        {t(
                                                            'admin-billing.subscriptions.cancelButton'
                                                        )}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
