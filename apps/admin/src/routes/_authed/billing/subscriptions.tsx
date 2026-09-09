import type { TranslationKey } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { usePlansQuery } from '@/features/billing-plans/hooks';
import { CancelSubscriptionDialog } from '@/features/billing-subscriptions/CancelSubscriptionDialog';
import { ChangePlanDialog } from '@/features/billing-subscriptions/ChangePlanDialog';
import { ExtendTrialDialog } from '@/features/billing-subscriptions/ExtendTrialDialog';
import { GrantCompDialog } from '@/features/billing-subscriptions/GrantCompDialog';
import { GrantCourtesyDialog } from '@/features/billing-subscriptions/GrantCourtesyDialog';
import {
    useCancelSubscriptionMutation,
    useChangePlanMutation,
    useExtendTrialMutation,
    useGrantCompMutation,
    useGrantCourtesyMutation,
    usePauseSubscriptionMutation,
    useResumeSubscriptionMutation,
    useSubscriptionsQuery
} from '@/features/billing-subscriptions/hooks';
import { PauseSubscriptionDialog } from '@/features/billing-subscriptions/PauseSubscriptionDialog';
import { ResumeSubscriptionDialog } from '@/features/billing-subscriptions/ResumeSubscriptionDialog';
import { SubscriptionDetailsDialog } from '@/features/billing-subscriptions/SubscriptionDetailsDialog';
import { SubscriptionFilters } from '@/features/billing-subscriptions/SubscriptionFilters';
import { SubscriptionsTable } from '@/features/billing-subscriptions/SubscriptionsTable';
import type { Subscription, SubscriptionStatus } from '@/features/billing-subscriptions/types';
import { buildGrantCompPayload } from '@/features/billing-subscriptions/utils';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';

export const Route = createFileRoute('/_authed/billing/subscriptions')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
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
    const [productDomainFilter, setProductDomainFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog state
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
    const [extendTrialDialogOpen, setExtendTrialDialogOpen] = useState(false);
    const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
    const [courtesyDialogOpen, setCourtesyDialogOpen] = useState(false);
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
    const [compDialogOpen, setCompDialogOpen] = useState(false);

    // Data fetching
    const {
        data: subscriptionsData,
        isLoading,
        isError
    } = useSubscriptionsQuery({
        status: statusFilter,
        productDomain: productDomainFilter,
        search: searchQuery
    });

    /**
     * Filtering is the SERVER's job and is not repeated here.
     *
     * The page used to re-filter this list client-side. That is wrong twice over
     * on a paginated endpoint: it can only ever narrow the current page, so a
     * match on page 2 stays invisible, and it silently disagrees with the totals
     * the API reports. It also could not have worked at all — it matched
     * `sub.planSlug` (a slug) against a plan CATEGORY, and read `userName` /
     * `userEmail`, fields the API has never returned.
     *
     * The status filter in particular MUST stay server-side: `cancelled` has to
     * match rows physically stored as qzpay's `canceled` too, and only the
     * service knows to widen it.
     */
    const subscriptions = subscriptionsData?.items ?? [];

    // Plans query — needed to resolve plan slug -> UUID for the qzpay
    // change-plan endpoint (UUIDs only) and to feed the grant-comp plan
    // selector (HOS-1314), which needs EVERY comped-able plan across every
    // vertical, not just the first page.
    //
    // `pageSize: 100` is the server's own hard ceiling
    // (`BillingPlanSearchSchema.pageSize.max` in
    // `packages/schemas/src/api/billing/billing-plan.schema.ts`) — the most a
    // single request can ever return, so there is no larger fixed value to
    // ask for. The unqualified default (20) undercounted today's own seed:
    // ALL_PLANS (5) + 3 trial + 3 gastronomy + 3 experience + 3 partner +
    // owner-test-daily is ~18 non-deleted rows already, two short of the
    // default page. The truncation guard below is what stops a FUTURE
    // overflow (e.g. a HOS-1062 negotiated plan pushing past 100) from
    // silently dropping a plan out of the selector with no signal at all.
    const { data: plansData } = usePlansQuery({ pageSize: 100 });

    // HOS-1314 review: a plan the operator cannot see in the selector is a
    // plan nobody can grant a comp for, with no error anywhere — the exact
    // "fails silently" this guard exists to close. Fires at most once per
    // mount (not once per render/refetch) so it cannot spam the toast queue.
    const plansTruncationWarned = useRef(false);
    useEffect(() => {
        if (!plansData) return;
        const total = plansData.pagination.total;
        const totalCount = typeof total === 'number' ? total : Number(total);
        if (
            !plansTruncationWarned.current &&
            Number.isFinite(totalCount) &&
            totalCount > plansData.items.length
        ) {
            plansTruncationWarned.current = true;
            addToast({
                message: `${t('admin-billing.subscriptions.toasts.plansTruncated')} ${plansData.items.length}/${totalCount}`,
                variant: 'warning'
            });
        }
    }, [plansData, addToast, t]);

    // Mutations
    const cancelMutation = useCancelSubscriptionMutation();
    const changePlanMutation = useChangePlanMutation();
    const extendTrialMutation = useExtendTrialMutation();
    const pauseMutation = usePauseSubscriptionMutation();
    const grantCourtesyMutation = useGrantCourtesyMutation();
    const resumeMutation = useResumeSubscriptionMutation();
    const grantCompMutation = useGrantCompMutation();

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

    const handleGrantCourtesyClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setCourtesyDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleGrantCompClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setCompDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    /**
     * Confirms a courtesy grant.
     *
     * The endpoint's refusals are surfaced verbatim rather than replaced with a
     * generic message: a grant rejected for being under three days from the next
     * charge comes back naming that date, which is exactly what tells the admin
     * to come back earlier in the period (HOS-180 R-6).
     */
    const handleConfirmGrantCourtesy = (cycles: number) => {
        if (!selectedSubscription) return;
        grantCourtesyMutation.mutate(
            { subscriptionId: selectedSubscription.id, cycles },
            {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.subscriptions.toasts.courtesyGranted'),
                        variant: 'success'
                    });
                    setCourtesyDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.courtesyError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    /**
     * Confirms a comp grant (HOS-1314).
     *
     * The success toast names the VERTICAL that got comped, not just "listo" —
     * the issue's own T-3 requirement, because an operator who picked the
     * wrong plan otherwise has no confirmation of which entitlements the
     * customer actually received. The domain is resolved from the SAME
     * `plansData` the dialog's own selector reads from, mirroring how
     * `handleConfirmChangePlan` resolves `newPlanName` below.
     */
    const handleConfirmGrantComp = (payload: {
        planId: string;
        interval: 'monthly' | 'annual';
    }) => {
        if (!selectedSubscription) return;

        const planRow = plansData?.items?.find((p) => p.id === payload.planId);
        const domainLabel = planRow
            ? t(
                  `admin-billing.subscriptions.productDomainLabels.${planRow.productDomain}` as TranslationKey
              )
            : payload.planId;

        grantCompMutation.mutate(
            buildGrantCompPayload({
                subscription: selectedSubscription,
                planId: payload.planId,
                interval: payload.interval
            }),
            {
                onSuccess: () => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.compGranted')} ${domainLabel}`,
                        variant: 'success'
                    });
                    setCompDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.subscriptions.toasts.compError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
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
        ) as { id?: string; name?: string } | undefined;
        const newPlanId = planRow?.id;
        // Name comes from the DB-backed /plans response, not the static
        // ALL_PLANS catalog: a plan created in the admin has no entry there.
        const newPlanName = planRow?.name;

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
                        message: `${t('admin-billing.subscriptions.toasts.planChanged')} ${newPlanName ?? newPlanSlug}`,
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
                    productDomainFilter={productDomainFilter}
                    onProductDomainChange={setProductDomainFilter}
                />

                <SubscriptionsTable
                    subscriptions={subscriptions}
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
                onGrantCourtesy={handleGrantCourtesyClick}
                onResume={handleResumeClick}
                onGrantComp={handleGrantCompClick}
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

                    <GrantCourtesyDialog
                        subscription={selectedSubscription}
                        isOpen={courtesyDialogOpen}
                        onClose={() => setCourtesyDialogOpen(false)}
                        onConfirm={handleConfirmGrantCourtesy}
                    />

                    <GrantCompDialog
                        subscription={selectedSubscription}
                        plans={plansData?.items ?? []}
                        isOpen={compDialogOpen}
                        onClose={() => setCompDialogOpen(false)}
                        onConfirm={handleConfirmGrantComp}
                        isPending={grantCompMutation.isPending}
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
