import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { usePlansQuery } from '@/features/billing-plans/hooks';
import { CancelSubscriptionDialog } from '@/features/billing-subscriptions/CancelSubscriptionDialog';
import { ChangePlanDialog } from '@/features/billing-subscriptions/ChangePlanDialog';
import { ExtendTrialDialog } from '@/features/billing-subscriptions/ExtendTrialDialog';
import { PauseSubscriptionDialog } from '@/features/billing-subscriptions/PauseSubscriptionDialog';
import { ResumeSubscriptionDialog } from '@/features/billing-subscriptions/ResumeSubscriptionDialog';
import { SubscriptionDetailsDialog } from '@/features/billing-subscriptions/SubscriptionDetailsDialog';
import { SubscriptionFilters } from '@/features/billing-subscriptions/SubscriptionFilters';
import { SubscriptionsTable } from '@/features/billing-subscriptions/SubscriptionsTable';
import {
    useCancelSubscriptionMutation,
    useChangePlanMutation,
    useExtendTrialMutation,
    usePauseSubscriptionMutation,
    useResumeSubscriptionMutation,
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
    const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false);

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

    // Plans query — needed to resolve plan slug -> UUID for the qzpay
    // change-plan endpoint, which only accepts UUIDs.
    const { data: plansData } = usePlansQuery();

    // Mutations
    const cancelMutation = useCancelSubscriptionMutation();
    const changePlanMutation = useChangePlanMutation();
    const extendTrialMutation = useExtendTrialMutation();
    const pauseMutation = usePauseSubscriptionMutation();
    const resumeMutation = useResumeSubscriptionMutation();

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

    const handlePauseClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setPauseDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleResumeClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setResumeDialogOpen(true);
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

        // The dialog selects by slug (the local plan config), but qzpay
        // change-plan needs the DB UUID. Resolve via the admin /plans query.
        const planRow = plansData?.items?.find(
            (p) => (p as { slug?: string }).slug === newPlanSlug
        ) as { id?: string } | undefined;
        const newPlanId = planRow?.id;
        const newPlanDef = getPlanBySlug(newPlanSlug);

        if (!newPlanId) {
            addToast({
                message: `${t('admin-billing.subscriptions.toasts.planChangeError')} unknown plan`,
                variant: 'error'
            });
            return;
        }

        changePlanMutation.mutate(
            { subscriptionId: selectedSubscription.id, newPlanId },
            {
                onSuccess: () => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.planChanged')} ${newPlanDef?.name ?? newPlanSlug}`,
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

    const handleConfirmPause = (suspendService: boolean) => {
        if (!selectedSubscription) return;

        pauseMutation.mutate(
            { id: selectedSubscription.id, suspendService },
            {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.subscriptions.toasts.paused'),
                        variant: 'success'
                    });
                    setPauseDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.pauseError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleConfirmResume = () => {
        if (!selectedSubscription) return;

        resumeMutation.mutate(
            { id: selectedSubscription.id },
            {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.subscriptions.toasts.resumed'),
                        variant: 'success'
                    });
                    setResumeDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.resumeError')} ${error.message}`,
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
                    <h1 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.subscriptions.title')}
                    </h1>
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
                onPause={handlePauseClick}
                onResume={handleResumeClick}
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

                    <PauseSubscriptionDialog
                        subscription={selectedSubscription}
                        isOpen={pauseDialogOpen}
                        onClose={() => setPauseDialogOpen(false)}
                        onConfirm={handleConfirmPause}
                    />

                    <ResumeSubscriptionDialog
                        subscription={selectedSubscription}
                        isOpen={resumeDialogOpen}
                        onClose={() => setResumeDialogOpen(false)}
                        onConfirm={handleConfirmResume}
                    />
                </>
            )}
        </SidebarPageLayout>
    );
}
