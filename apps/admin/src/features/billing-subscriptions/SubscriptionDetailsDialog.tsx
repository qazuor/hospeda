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
    useSubscriptionEventsQuery,
    useSubscriptionPromoEffectQuery
} from '@/features/billing-subscriptions/hooks';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CalendarIcon, CreditCardIcon, PlayIcon, PowerOffIcon, XCircleIcon } from '@repo/icons';
import { useState } from 'react';
import { SubscriptionPaymentHistoryBlock } from './SubscriptionPaymentHistoryBlock';
import { SubscriptionPromoEffectPanel } from './SubscriptionPromoEffectPanel';
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
    readonly onPause: (sub: Subscription) => void;
    readonly onResume: (sub: Subscription) => void;
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
    onExtendTrial,
    onPause,
    onResume
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

    const { data: promoEffect, isLoading: isLoadingPromoEffect } = useSubscriptionPromoEffectQuery(
        subscription?.id ?? '',
        isOpen && !!subscription?.id
    );

    if (!subscription) return null;

    const plan = getPlanBySlug(subscription.planSlug);

    // Map API payment data to PaymentHistory interface.
    // `paymentData` is already validated by the query hook (SPEC-039), so no
    // cast is needed here — only a status-string narrowing.
    const paymentHistory: PaymentHistory[] = (paymentData ?? []).map((p) => ({
        id: p.id,
        date: p.createdAt,
        amount: p.amount / 100,
        status:
            p.status === 'completed'
                ? ('paid' as const)
                : p.status === 'pending'
                  ? ('pending' as const)
                  : ('failed' as const)
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
                                <div className="rounded-md border bg-card p-3">
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
                                <div className="space-y-2 rounded-md border bg-card p-3">
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
                                            <span className="text-sm text-success">
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

                            {/* Active promo effect */}
                            <SubscriptionPromoEffectPanel
                                effect={promoEffect ?? null}
                                isLoading={isLoadingPromoEffect}
                                trialEnd={subscription.trialEnd}
                            />

                            {/* Entitlements */}
                            {plan && (
                                <div>
                                    <h3 className="mb-2 font-medium text-sm">
                                        {t(
                                            'admin-billing.subscriptions.detailsDialog.entitlementsTitle'
                                        )}
                                    </h3>
                                    <div className="rounded-md border bg-card p-3">
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
                            <SubscriptionPaymentHistoryBlock
                                paymentHistory={paymentHistory}
                                isLoading={isLoadingPayments}
                            />

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
                                {(subscription.status === 'active' ||
                                    subscription.status === 'trialing') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPause(subscription)}
                                    >
                                        <PowerOffIcon className="mr-2 h-4 w-4" />
                                        {t('admin-billing.subscriptions.detailsDialog.pauseButton')}
                                    </Button>
                                )}
                                {subscription.status === 'paused' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onResume(subscription)}
                                    >
                                        <PlayIcon className="mr-2 h-4 w-4" />
                                        {t(
                                            'admin-billing.subscriptions.detailsDialog.resumeButton'
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
                                        className="flex items-start gap-3 rounded-lg border bg-card p-3"
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
