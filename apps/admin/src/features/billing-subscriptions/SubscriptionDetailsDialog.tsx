import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    usePaymentHistoryQuery,
    useSubscriptionEventsQuery
} from '@/features/billing-subscriptions/hooks';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CalendarIcon, CreditCardIcon, LoaderIcon, XCircleIcon } from '@repo/icons';
import { useState } from 'react';
import type { PaymentHistory, Subscription, SubscriptionStatus } from './types';
import { formatArs, formatDate, getPlanBySlug, getStatusLabel, getStatusVariant } from './utils';

/**
 * Props for SubscriptionDetailsDialog
 */
export interface SubscriptionDetailsDialogProps {
    readonly subscription: Subscription | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onCancel: (sub: Subscription) => void;
    readonly onChangePlan: (sub: Subscription) => void;
    readonly onExtendTrial: (sub: Subscription) => void;
}

/**
 * Subscription details dialog component.
 * Displays full subscription information, entitlements, payment history,
 * and action buttons for cancel, change plan, and extend trial.
 */
export function SubscriptionDetailsDialog({
    subscription,
    isOpen,
    onClose,
    onCancel,
    onChangePlan,
    onExtendTrial
}: SubscriptionDetailsDialogProps) {
    const { t, locale } = useTranslations();
    const [activeTab, setActiveTab] = useState('detalles');
    const [eventsPage, setEventsPage] = useState(1);

    const { data: paymentData, isLoading: isLoadingPayments } = usePaymentHistoryQuery(
        subscription?.id
    );

    const eventsQuery = useSubscriptionEventsQuery({
        subscriptionId: subscription?.id ?? '',
        page: eventsPage,
        pageSize: 10,
        enabled: activeTab === 'historial' && !!subscription?.id
    });

    if (!subscription) return null;

    const plan = getPlanBySlug(subscription.planSlug);

    // Map API payment data to PaymentHistory interface
    const paymentHistory: PaymentHistory[] = (
        (paymentData as unknown as
            | Array<{ id: string; createdAt: string; amount: number; status: string }>
            | undefined) ?? []
    ).map((p) => ({
        id: p.id,
        date: p.createdAt,
        amount: p.amount / 100,
        status: (p.status === 'completed'
            ? 'paid'
            : p.status === 'pending'
              ? 'pending'
              : 'failed') as 'paid' | 'pending' | 'failed'
    }));

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.detailsDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.detailsDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                >
                    <TabsList>
                        <TabsTrigger value="detalles">
                            {t('admin-billing.subscriptions.detailsDialog.tabs.details')}
                        </TabsTrigger>
                        <TabsTrigger value="historial">
                            {t('admin-billing.subscriptions.detailsDialog.tabs.history')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="detalles">
                        <div className="space-y-4">
                            {/* User info */}
                            <div>
                                <h3 className="mb-2 font-medium text-sm">
                                    {t('admin-billing.subscriptions.detailsDialog.userSection')}
                                </h3>
                                <div className="rounded-md border p-3">
                                    <p className="font-medium">{subscription.userName}</p>
                                    <p className="text-muted-foreground text-sm">
                                        {subscription.userEmail}
                                    </p>
                                    <p className="mt-1 text-muted-foreground text-xs">
                                        {t('admin-billing.subscriptions.detailsDialog.idLabel')}{' '}
                                        {subscription.userId}
                                    </p>
                                </div>
                            </div>

                            {/* Subscription info */}
                            <div>
                                <h3 className="mb-2 font-medium text-sm">
                                    {t(
                                        'admin-billing.subscriptions.detailsDialog.subscriptionSection'
                                    )}
                                </h3>
                                <div className="space-y-2 rounded-md border p-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t('admin-billing.subscriptions.detailsDialog.idLabel')}
                                        </span>
                                        <span className="font-mono text-sm">{subscription.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.planLabel'
                                            )}
                                        </span>
                                        <span className="text-sm">{plan?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.statusLabel'
                                            )}
                                        </span>
                                        <Badge variant={getStatusVariant(subscription.status)}>
                                            {getStatusLabel(subscription.status, t)}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.startLabel'
                                            )}
                                        </span>
                                        <span className="text-sm">
                                            {formatDate(subscription.startDate, locale)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.periodEndLabel'
                                            )}
                                        </span>
                                        <span className="text-sm">
                                            {formatDate(subscription.currentPeriodEnd, locale)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.monthlyAmountLabel'
                                            )}
                                        </span>
                                        <span className="font-medium text-sm">
                                            {formatArs(subscription.monthlyAmount, locale)}
                                        </span>
                                    </div>
                                    {subscription.discountPercent && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-sm">
                                                {t(
                                                    'admin-billing.subscriptions.detailsDialog.discountLabel'
                                                )}
                                            </span>
                                            <span className="text-green-600 text-sm dark:text-green-400">
                                                {subscription.discountPercent}%
                                            </span>
                                        </div>
                                    )}
                                    {subscription.trialEnd && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground text-sm">
                                                {t(
                                                    'admin-billing.subscriptions.detailsDialog.trialEndLabel'
                                                )}
                                            </span>
                                            <span className="text-sm">
                                                {formatDate(subscription.trialEnd, locale)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Entitlements */}
                            {plan && (
                                <div>
                                    <h3 className="mb-2 font-medium text-sm">
                                        {t(
                                            'admin-billing.subscriptions.detailsDialog.entitlementsTitle'
                                        )}
                                    </h3>
                                    <div className="rounded-md border p-3">
                                        <ul className="space-y-1 text-sm">
                                            {plan.entitlements.slice(0, 5).map((entitlement) => (
                                                <li key={entitlement}>
                                                    • {entitlement.replace(/_/g, ' ')}
                                                </li>
                                            ))}
                                            {plan.entitlements.length > 5 && (
                                                <li className="text-muted-foreground text-xs">
                                                    +{plan.entitlements.length - 5}{' '}
                                                    {t(
                                                        'admin-billing.subscriptions.detailsDialog.entitlementsMore'
                                                    )}
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Payment history */}
                            <div>
                                <h3 className="mb-2 font-medium text-sm">
                                    {t('admin-billing.subscriptions.paymentHistory.title')}
                                </h3>
                                {isLoadingPayments ? (
                                    <div className="rounded-md border p-6 text-center">
                                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground text-xs">
                                            {t(
                                                'admin-billing.subscriptions.paymentHistory.loading'
                                            )}
                                        </p>
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="rounded-md border p-6 text-center">
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-billing.subscriptions.paymentHistory.empty')}
                                        </p>
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {t(
                                                'admin-billing.subscriptions.paymentHistory.emptyHint'
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-md border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">
                                                        {t(
                                                            'admin-billing.subscriptions.paymentHistory.dateColumn'
                                                        )}
                                                    </th>
                                                    <th className="px-3 py-2 text-right font-medium">
                                                        {t(
                                                            'admin-billing.subscriptions.paymentHistory.amountColumn'
                                                        )}
                                                    </th>
                                                    <th className="px-3 py-2 text-center font-medium">
                                                        {t(
                                                            'admin-billing.subscriptions.paymentHistory.statusColumn'
                                                        )}
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
                                                                        : payment.status ===
                                                                            'pending'
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

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onChangePlan(subscription)}
                                >
                                    <CreditCardIcon className="mr-2 h-4 w-4" />
                                    {t(
                                        'admin-billing.subscriptions.detailsDialog.changePlanButton'
                                    )}
                                </Button>
                                {subscription.status === 'trialing' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onExtendTrial(subscription)}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {t(
                                            'admin-billing.subscriptions.detailsDialog.extendTrialButton'
                                        )}
                                    </Button>
                                )}
                                {subscription.status === 'active' &&
                                    !subscription.cancelAtPeriodEnd && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onCancel(subscription)}
                                        >
                                            <XCircleIcon className="mr-2 h-4 w-4" />
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.cancelSubscriptionButton'
                                            )}
                                        </Button>
                                    )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="historial">
                        {eventsQuery.isLoading && (
                            <div className="flex justify-center py-8">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.subscriptions.detailsDialog.history.loading')}
                                </span>
                            </div>
                        )}
                        {eventsQuery.data && eventsQuery.data.items.length === 0 && (
                            <div className="flex justify-center py-8">
                                <span className="text-muted-foreground">
                                    {t(
                                        'admin-billing.subscriptions.detailsDialog.history.emptyState'
                                    )}
                                </span>
                            </div>
                        )}
                        {eventsQuery.data && eventsQuery.data.items.length > 0 && (
                            <div className="space-y-3">
                                {eventsQuery.data.items.map((event) => (
                                    <div
                                        key={event.id}
                                        className="flex items-start gap-3 rounded-lg border p-3"
                                    >
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={getStatusVariant(
                                                        event.previousStatus as SubscriptionStatus
                                                    )}
                                                >
                                                    {getStatusLabel(
                                                        event.previousStatus as SubscriptionStatus,
                                                        t
                                                    )}
                                                </Badge>
                                                <span className="text-muted-foreground">→</span>
                                                <Badge
                                                    variant={getStatusVariant(
                                                        event.newStatus as SubscriptionStatus
                                                    )}
                                                >
                                                    {getStatusLabel(
                                                        event.newStatus as SubscriptionStatus,
                                                        t
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                <span>{formatDate(event.createdAt)}</span>
                                                <span>·</span>
                                                <span>
                                                    {t(
                                                        `admin-billing.subscriptions.detailsDialog.history.sources.${event.triggerSource}` as TranslationKey
                                                    )}
                                                </span>
                                            </div>
                                            {event.providerEventId && (
                                                <div className="text-muted-foreground text-xs">
                                                    {t(
                                                        'admin-billing.subscriptions.detailsDialog.history.columns.eventId'
                                                    )}
                                                    : {event.providerEventId}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {eventsQuery.data.pagination.totalPages > 1 && (
                                    <div className="flex justify-between pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={eventsPage <= 1}
                                            onClick={() => setEventsPage((p) => p - 1)}
                                        >
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.history.pagination.previous'
                                            )}
                                        </Button>
                                        <span className="text-muted-foreground text-sm">
                                            {eventsPage} / {eventsQuery.data.pagination.totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                eventsPage >= eventsQuery.data.pagination.totalPages
                                            }
                                            onClick={() => setEventsPage((p) => p + 1)}
                                        >
                                            {t(
                                                'admin-billing.subscriptions.detailsDialog.history.pagination.next'
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
