import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { CancelSubscriptionDialog } from '@/features/billing-subscriptions/CancelSubscriptionDialog';
import { ChangePlanDialog } from '@/features/billing-subscriptions/ChangePlanDialog';
import { ExtendTrialDialog } from '@/features/billing-subscriptions/ExtendTrialDialog';
import { SubscriptionDetailsDialog } from '@/features/billing-subscriptions/SubscriptionDetailsDialog';
import { SubscriptionFilters } from '@/features/billing-subscriptions/SubscriptionFilters';
import { SubscriptionsTable } from '@/features/billing-subscriptions/SubscriptionsTable';
import {
    useCancelSubscriptionMutation,
    useChangePlanMutation,
    useExtendTrialMutation,
    useSubscriptionsQuery
} from '@/features/billing-subscriptions/hooks';
import type { Subscription, SubscriptionStatus } from '@/features/billing-subscriptions/types';
import { getPlanBySlug } from '@/features/billing-subscriptions/utils';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/subscriptions')({
    component: BillingSubscriptionsPage
});

/**
 * Billing subscriptions page.
 * Orchestrates state management, data fetching, and mutations.
 * Delegates all UI rendering to feature components.
 */
function BillingSubscriptionsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // Filter state
    const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog state
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
    const [extendTrialDialogOpen, setExtendTrialDialogOpen] = useState(false);

    // Data fetching
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

    const filteredSubscriptions = subscriptions.filter((sub: Subscription) => {
        const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
        const matchesPlan = planFilter === 'all' || sub.planSlug === planFilter;
        const matchesSearch =
            searchQuery === '' ||
            sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesPlan && matchesSearch;
    });

    // Mutations
    const cancelMutation = useCancelSubscriptionMutation();
    const changePlanMutation = useChangePlanMutation();
    const extendTrialMutation = useExtendTrialMutation();

    // Handlers: navigation between dialogs
    const handleViewDetails = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setDetailsDialogOpen(true);
    };

    const handleCancelClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setCancelDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleChangePlanClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setChangePlanDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleExtendTrialClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setExtendTrialDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    // Handlers: mutations
    const handleConfirmCancel = (immediate: boolean, reason?: string) => {
        if (!selectedSubscription) return;

        cancelMutation.mutate(
            { id: selectedSubscription.id, immediate, reason },
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

    const handleConfirmChangePlan = (newPlanSlug: string) => {
        if (!selectedSubscription) return;

        changePlanMutation.mutate(
            { subscriptionId: selectedSubscription.id, newPlanSlug },
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

    const handleConfirmExtendTrial = (additionalDays: number) => {
        if (!selectedSubscription) return;

        extendTrialMutation.mutate(
            { subscriptionId: selectedSubscription.id, additionalDays },
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

                <SubscriptionFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    planFilter={planFilter}
                    onPlanChange={setPlanFilter}
                />

                <SubscriptionsTable
                    subscriptions={filteredSubscriptions}
                    isLoading={isLoading}
                    isError={isError}
                    onViewDetails={handleViewDetails}
                    onCancel={handleCancelClick}
                />
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
