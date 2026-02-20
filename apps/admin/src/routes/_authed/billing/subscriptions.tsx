import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    useCancelSubscriptionMutation,
    useChangePlanMutation,
    useExtendTrialMutation,
    usePaymentHistoryQuery,
    useSubscriptionsQuery
} from '@/features/billing-subscriptions/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import type { TranslationKey } from '@repo/i18n';
import { CalendarIcon, CreditCardIcon, LoaderIcon, XCircleIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/subscriptions')({
    component: BillingSubscriptionsPage
});

/**
 * Subscription status types matching billing system
 */
type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired';

/**
 * Subscription data structure
 */
interface Subscription {
    readonly id: string;
    readonly userId: string;
    readonly userName: string;
    readonly userEmail: string;
    readonly planSlug: string;
    readonly status: SubscriptionStatus;
    readonly startDate: string;
    readonly currentPeriodEnd: string;
    readonly monthlyAmount: number;
    readonly cancelAtPeriodEnd: boolean;
    readonly trialEnd?: string;
    readonly discountPercent?: number;
}

/**
 * Payment history entry
 */
interface PaymentHistory {
    readonly id: string;
    readonly date: string;
    readonly amount: number;
    readonly status: 'paid' | 'pending' | 'failed';
}

/**
 * Get status badge variant based on subscription status
 */
function getStatusVariant(
    status: SubscriptionStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variantMap: Record<
        SubscriptionStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        active: 'default',
        trialing: 'secondary',
        cancelled: 'destructive',
        past_due: 'outline',
        expired: 'outline'
    };
    return variantMap[status];
}

/**
 * Get status label using i18n
 */
function getStatusLabel(status: SubscriptionStatus, t: (key: TranslationKey) => string): string {
    const labels: Record<SubscriptionStatus, string> = {
        active: t('admin-billing.subscriptions.statuses.active'),
        trialing: t('admin-billing.subscriptions.statuses.trialing'),
        cancelled: t('admin-billing.subscriptions.statuses.cancelled'),
        past_due: t('admin-billing.subscriptions.statuses.pastDue'),
        expired: t('admin-billing.subscriptions.statuses.expired')
    };
    return labels[status];
}

/**
 * Format date to Spanish locale
 */
function formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date(date));
}

/**
 * Format ARS currency
 */
function formatArs(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Get plan details by slug
 */
function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

/**
 * Cancel confirmation dialog component
 */
function CancelSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (immediate: boolean, reason?: string) => void;
}) {
    const { t } = useTranslations();
    const [cancelImmediate, setCancelImmediate] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const handleConfirm = () => {
        onConfirm(cancelImmediate, cancelReason || undefined);
        setCancelReason('');
        setCancelImmediate(false);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.subscriptions.cancelDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.cancelDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cancel-timing">
                            {t('admin-billing.subscriptions.cancelDialog.timingLabel')}
                        </Label>
                        <select
                            id="cancel-timing"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelImmediate ? 'immediate' : 'end_of_period'}
                            onChange={(e) => setCancelImmediate(e.target.value === 'immediate')}
                        >
                            <option value="end_of_period">
                                {t('admin-billing.subscriptions.cancelDialog.endOfPeriod')} (
                                {formatDate(subscription.currentPeriodEnd)})
                            </option>
                            <option value="immediate">
                                {t('admin-billing.subscriptions.cancelDialog.immediate')}
                            </option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cancel-reason">
                            {t('admin-billing.subscriptions.cancelDialog.reasonLabel')}
                        </Label>
                        <select
                            id="cancel-reason"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        >
                            <option value="">
                                {t('admin-billing.subscriptions.cancelDialog.reasonPlaceholder')}
                            </option>
                            <option value="too_expensive">
                                {t('admin-billing.subscriptions.cancelDialog.reasons.tooExpensive')}
                            </option>
                            <option value="missing_features">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.missingFeatures'
                                )}
                            </option>
                            <option value="technical_issues">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.technicalIssues'
                                )}
                            </option>
                            <option value="switching_competitor">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.switchingCompetitor'
                                )}
                            </option>
                            <option value="business_closed">
                                {t(
                                    'admin-billing.subscriptions.cancelDialog.reasons.businessClosed'
                                )}
                            </option>
                            <option value="other">
                                {t('admin-billing.subscriptions.cancelDialog.reasons.other')}
                            </option>
                        </select>
                    </div>

                    {cancelImmediate && (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                            <p className="text-destructive text-sm">
                                {t('admin-billing.subscriptions.cancelDialog.immediateWarning')}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.subscriptions.cancelDialog.backButton')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                    >
                        {t('admin-billing.subscriptions.cancelDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Change plan dialog component
 */
function ChangePlanDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (newPlanSlug: string) => void;
}) {
    const { t } = useTranslations();
    const currentPlan = getPlanBySlug(subscription.planSlug);
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    const availablePlans = ALL_PLANS.filter(
        (plan) => plan.category === currentPlan?.category && plan.slug !== subscription.planSlug
    );

    const handleConfirm = () => {
        if (selectedPlan) {
            onConfirm(selectedPlan);
            setSelectedPlan('');
        }
    };

    const selectedPlanDef = selectedPlan ? getPlanBySlug(selectedPlan) : null;
    const proratedAmount =
        selectedPlanDef && currentPlan
            ? (selectedPlanDef.monthlyPriceArs - currentPlan.monthlyPriceArs) / 100
            : 0;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.changePlanDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.changePlanDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="mb-2 font-medium text-sm">
                            {t('admin-billing.subscriptions.changePlanDialog.currentPlan')}
                        </p>
                        <div className="rounded-md border p-3">
                            <p className="font-medium">{currentPlan?.name}</p>
                            <p className="text-muted-foreground text-sm">
                                {formatArs(currentPlan?.monthlyPriceArs ?? 0)}
                                {t('admin-billing.subscriptions.changePlanDialog.perMonth')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-plan">
                            {t('admin-billing.subscriptions.changePlanDialog.newPlanLabel')}
                        </Label>
                        <select
                            id="new-plan"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                        >
                            <option value="">
                                {t('admin-billing.subscriptions.changePlanDialog.selectPlan')}
                            </option>
                            {availablePlans.map((plan) => (
                                <option
                                    key={plan.slug}
                                    value={plan.slug}
                                >
                                    {plan.name} - {formatArs(plan.monthlyPriceArs)}
                                    {t('admin-billing.subscriptions.changePlanDialog.perMonth')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedPlanDef && (
                        <div className="rounded-md border bg-muted p-3">
                            <p className="mb-2 font-medium text-sm">
                                {t('admin-billing.subscriptions.changePlanDialog.prorationTitle')}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {proratedAmount > 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCharge'
                                        )}{' '}
                                        {formatArs(proratedAmount)}{' '}
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationChargeToday'
                                        )}
                                    </span>
                                )}
                                {proratedAmount < 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCredit'
                                        )}{' '}
                                        {formatArs(Math.abs(proratedAmount))}{' '}
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCreditToAccount'
                                        )}
                                    </span>
                                )}
                                {proratedAmount === 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationNone'
                                        )}
                                    </span>
                                )}
                            </p>
                            <p className="mt-2 text-muted-foreground text-xs">
                                {t('admin-billing.subscriptions.changePlanDialog.nextCharge')}{' '}
                                {formatDate(subscription.currentPeriodEnd)}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedPlan}
                    >
                        {t('admin-billing.subscriptions.changePlanDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Subscription details dialog component
 */
function SubscriptionDetailsDialog({
    subscription,
    isOpen,
    onClose,
    onCancel,
    onChangePlan,
    onExtendTrial
}: {
    readonly subscription: Subscription | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onCancel: (sub: Subscription) => void;
    readonly onChangePlan: (sub: Subscription) => void;
    readonly onExtendTrial: (sub: Subscription) => void;
}) {
    const { t } = useTranslations();
    const { data: paymentData, isLoading: isLoadingPayments } = usePaymentHistoryQuery(
        subscription?.id
    );

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
                            {t('admin-billing.subscriptions.detailsDialog.subscriptionSection')}
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
                                    {t('admin-billing.subscriptions.detailsDialog.planLabel')}
                                </span>
                                <span className="text-sm">{plan?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    {t('admin-billing.subscriptions.detailsDialog.statusLabel')}
                                </span>
                                <Badge variant={getStatusVariant(subscription.status)}>
                                    {getStatusLabel(subscription.status, t)}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    {t('admin-billing.subscriptions.detailsDialog.startLabel')}
                                </span>
                                <span className="text-sm">
                                    {formatDate(subscription.startDate)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    {t('admin-billing.subscriptions.detailsDialog.periodEndLabel')}
                                </span>
                                <span className="text-sm">
                                    {formatDate(subscription.currentPeriodEnd)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    {t(
                                        'admin-billing.subscriptions.detailsDialog.monthlyAmountLabel'
                                    )}
                                </span>
                                <span className="font-medium text-sm">
                                    {formatArs(subscription.monthlyAmount)}
                                </span>
                            </div>
                            {subscription.discountPercent && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-sm">
                                        {t(
                                            'admin-billing.subscriptions.detailsDialog.discountLabel'
                                        )}
                                    </span>
                                    <span className="text-green-600 text-sm">
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
                                        {formatDate(subscription.trialEnd)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Entitlements */}
                    {plan && (
                        <div>
                            <h3 className="mb-2 font-medium text-sm">
                                {t('admin-billing.subscriptions.detailsDialog.entitlementsTitle')}
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
                                                    {formatDate(payment.date)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {formatArs(payment.amount)}
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

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onChangePlan(subscription)}
                        >
                            <CreditCardIcon className="mr-2 h-4 w-4" />
                            {t('admin-billing.subscriptions.detailsDialog.changePlanButton')}
                        </Button>
                        {subscription.status === 'trialing' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onExtendTrial(subscription)}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {t('admin-billing.subscriptions.detailsDialog.extendTrialButton')}
                            </Button>
                        )}
                        {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
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

/**
 * Extend trial dialog component
 */
function ExtendTrialDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm,
    isPending
}: {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (additionalDays: number) => void;
    readonly isPending: boolean;
}) {
    const { t } = useTranslations();
    const [additionalDays, setAdditionalDays] = useState(7);

    const currentTrialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
    const newTrialEnd = currentTrialEnd
        ? new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000)
        : null;

    const handleConfirm = () => {
        onConfirm(additionalDays);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.extendTrialDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.extendTrialDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="extend-days">
                            {t('admin-billing.subscriptions.extendTrialDialog.daysLabel')}
                        </Label>
                        <Input
                            id="extend-days"
                            type="number"
                            min={1}
                            max={90}
                            value={additionalDays}
                            onChange={(e) => setAdditionalDays(Number(e.target.value))}
                        />
                        <p className="text-muted-foreground text-xs">
                            {t('admin-billing.subscriptions.extendTrialDialog.daysHint')}
                        </p>
                    </div>

                    <div className="rounded-md border bg-muted p-3">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.subscriptions.extendTrialDialog.currentEnd')}
                                </span>
                                <span>
                                    {currentTrialEnd
                                        ? formatDate(currentTrialEnd.toISOString())
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.subscriptions.extendTrialDialog.newEnd')}
                                </span>
                                <span className="font-medium">
                                    {newTrialEnd ? formatDate(newTrialEnd.toISOString()) : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={additionalDays < 1 || additionalDays > 90 || isPending}
                    >
                        {isPending && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                        {t('admin-billing.subscriptions.extendTrialDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Main subscriptions page component
 */
function BillingSubscriptionsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
    const [extendTrialDialogOpen, setExtendTrialDialogOpen] = useState(false);

    // Fetch subscriptions with filters
    const {
        data: subscriptionsData,
        isLoading,
        isError
    } = useSubscriptionsQuery({
        status: statusFilter,
        planSlug: planFilter,
        q: searchQuery
    });

    const subscriptions = ((subscriptionsData as { items?: Subscription[] } | undefined)?.items ??
        []) as Subscription[];

    // Mutations
    const cancelMutation = useCancelSubscriptionMutation();
    const changePlanMutation = useChangePlanMutation();
    const extendTrialMutation = useExtendTrialMutation();

    const filteredSubscriptions = subscriptions.filter((sub: Subscription) => {
        const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
        const matchesPlan = planFilter === 'all' || sub.planSlug === planFilter;
        const matchesSearch =
            searchQuery === '' ||
            sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesPlan && matchesSearch;
    });

    const handleViewDetails = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setDetailsDialogOpen(true);
    };

    const handleCancelClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setCancelDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleConfirmCancel = (immediate: boolean, reason?: string) => {
        if (!selectedSubscription) return;

        cancelMutation.mutate(
            {
                id: selectedSubscription.id,
                immediate,
                reason
            },
            {
                onSuccess: () => {
                    addToast({
                        message: immediate
                            ? t('admin-billing.subscriptions.toasts.cancelledImmediate')
                            : t('admin-billing.subscriptions.toasts.cancelledScheduled'),
                        variant: 'success'
                    });
                    setCancelDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.cancelError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleChangePlanClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setChangePlanDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleConfirmChangePlan = (newPlanSlug: string) => {
        if (!selectedSubscription) return;

        changePlanMutation.mutate(
            {
                subscriptionId: selectedSubscription.id,
                newPlanSlug
            },
            {
                onSuccess: () => {
                    const newPlan = getPlanBySlug(newPlanSlug);
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.planChanged')} ${newPlan?.name}`,
                        variant: 'success'
                    });
                    setChangePlanDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.planChangeError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleExtendTrialClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setExtendTrialDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleConfirmExtendTrial = (additionalDays: number) => {
        if (!selectedSubscription) return;

        extendTrialMutation.mutate(
            {
                subscriptionId: selectedSubscription.id,
                additionalDays
            },
            {
                onSuccess: () => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.trialExtended')} ${additionalDays} ${t('admin-billing.subscriptions.toasts.trialExtendedDays')}`,
                        variant: 'success'
                    });
                    setExtendTrialDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.trialExtendError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    // Get unique plan categories for filter
    const planCategories = Array.from(new Set(ALL_PLANS.map((plan) => plan.category)));

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.subscriptions.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.subscriptions.description')}
                    </p>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.subscriptions.filtersTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="search">
                                    {t('admin-billing.subscriptions.searchLabel')}
                                </Label>
                                <Input
                                    id="search"
                                    placeholder={t('admin-billing.subscriptions.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label htmlFor="status">
                                    {t('admin-billing.subscriptions.statusFilter')}
                                </Label>
                                <select
                                    id="status"
                                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value as SubscriptionStatus | 'all'
                                        )
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.subscriptions.allFilter')}
                                    </option>
                                    <option value="active">
                                        {t('admin-billing.subscriptions.statuses.active')}
                                    </option>
                                    <option value="trialing">
                                        {t('admin-billing.subscriptions.statuses.trialing')}
                                    </option>
                                    <option value="past_due">
                                        {t('admin-billing.subscriptions.statuses.pastDue')}
                                    </option>
                                    <option value="cancelled">
                                        {t('admin-billing.subscriptions.statuses.cancelled')}
                                    </option>
                                    <option value="expired">
                                        {t('admin-billing.subscriptions.statuses.expired')}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="plan">
                                    {t('admin-billing.subscriptions.planCategoryFilter')}
                                </Label>
                                <select
                                    id="plan"
                                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={planFilter}
                                    onChange={(e) => setPlanFilter(e.target.value)}
                                >
                                    <option value="all">
                                        {t('admin-billing.subscriptions.allCategories')}
                                    </option>
                                    {planCategories.map((category) => (
                                        <option
                                            key={category}
                                            value={category}
                                        >
                                            {category === 'owner'
                                                ? t('admin-billing.subscriptions.categoryOwner')
                                                : category === 'complex'
                                                  ? t('admin-billing.subscriptions.categoryComplex')
                                                  : t(
                                                        'admin-billing.subscriptions.categoryTourist'
                                                    )}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Subscriptions Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.subscriptions.tableTitle')}</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? t('admin-billing.subscriptions.loadingSubscriptions')
                                : isError
                                  ? t('admin-billing.subscriptions.errorLoading')
                                  : filteredSubscriptions.length === 0
                                    ? t('admin-billing.subscriptions.noSubscriptions')
                                    : `${filteredSubscriptions.length} ${filteredSubscriptions.length !== 1 ? t('admin-billing.subscriptions.subscriptionCountPlural') : t('admin-billing.subscriptions.subscriptionCount')}`}
                        </CardDescription>
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
                        ) : filteredSubscriptions.length === 0 ? (
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
                                                {t(
                                                    'admin-billing.subscriptions.columns.monthlyAmount'
                                                )}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-billing.subscriptions.columns.actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSubscriptions.map((subscription: Subscription) => {
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
                                                            <div className="font-medium">
                                                                {plan?.name}
                                                            </div>
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
                                                            variant={getStatusVariant(
                                                                subscription.status
                                                            )}
                                                        >
                                                            {getStatusLabel(subscription.status, t)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                                        {formatDate(subscription.startDate)}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                                        {formatDate(subscription.currentPeriodEnd)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {formatArs(subscription.monthlyAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleViewDetails(subscription)
                                                                }
                                                            >
                                                                {t(
                                                                    'admin-billing.subscriptions.viewButton'
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleCancelClick(subscription)
                                                                }
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
            </div>

            {/* Dialogs */}
            <SubscriptionDetailsDialog
                subscription={selectedSubscription}
                isOpen={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                onCancel={handleCancelClick}
                onChangePlan={handleChangePlanClick}
                onExtendTrial={handleExtendTrialClick}
            />

            {selectedSubscription && (
                <>
                    <CancelSubscriptionDialog
                        subscription={selectedSubscription}
                        isOpen={cancelDialogOpen}
                        onClose={() => setCancelDialogOpen(false)}
                        onConfirm={handleConfirmCancel}
                    />

                    <ChangePlanDialog
                        subscription={selectedSubscription}
                        isOpen={changePlanDialogOpen}
                        onClose={() => setChangePlanDialogOpen(false)}
                        onConfirm={handleConfirmChangePlan}
                    />

                    <ExtendTrialDialog
                        subscription={selectedSubscription}
                        isOpen={extendTrialDialogOpen}
                        onClose={() => setExtendTrialDialogOpen(false)}
                        onConfirm={handleConfirmExtendTrial}
                        isPending={extendTrialMutation.isPending}
                    />
                </>
            )}
        </SidebarPageLayout>
    );
}
