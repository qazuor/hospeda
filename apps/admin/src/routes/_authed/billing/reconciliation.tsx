import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/ToastProvider';
import {
    DivergenceDetailDialog,
    DivergenceTable,
    ReconcileActionDialog,
    TruncatedBanner,
    useBackfillPaymentMutation,
    useDivergencesQuery,
    useForceLinkMutation
} from '@/features/billing-reconciliation';
import type {
    Divergence,
    DivergenceKind,
    ReconcileAction
} from '@/features/billing-reconciliation/types';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingReconciliationAccess } from '@/lib/billing-access';

export const Route = createFileRoute('/_authed/billing/reconciliation')({
    beforeLoad: ({ context }) => requireBillingReconciliationAccess(context),
    component: BillingReconciliationPage
});

/** Which rescue verb an orphan divergence naturally maps to. */
function getActionForDivergence(divergence: Divergence): ReconcileAction {
    return divergence.kind === 'orphan-preapproval' ? 'force-link' : 'backfill-payment';
}

/**
 * Orphan-payment rescue page (HOS-765).
 *
 * Orchestrates state/data-fetching and delegates all rendering to the
 * `billing-reconciliation` feature components. Mirrors the
 * `billing/payments.tsx` page structure.
 */
function BillingReconciliationPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // Filters
    const [kindFilter, setKindFilter] = useState<DivergenceKind | 'all'>('all');
    const [sinceDate, setSinceDate] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 20;

    // Dialog state
    const [selectedDivergence, setSelectedDivergence] = useState<Divergence | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [actionKind, setActionKind] = useState<ReconcileAction>('force-link');
    // Only ever set by an explicit "Usar este" click inside the detail
    // dialog — never derived from the divergence's own candidate list.
    const [prefillLocalSubscriptionId, setPrefillLocalSubscriptionId] = useState<string | null>(
        null
    );

    const since = sinceDate ? new Date(`${sinceDate}T00:00:00.000Z`).toISOString() : undefined;

    const {
        data: report,
        isLoading,
        isError
    } = useDivergencesQuery({
        kind: kindFilter === 'all' ? undefined : kindFilter,
        since,
        page,
        pageSize
    });

    const divergences = report?.items ?? [];

    const forceLinkMutation = useForceLinkMutation();
    const backfillMutation = useBackfillPaymentMutation();

    const handleViewDetails = (divergence: Divergence) => {
        setSelectedDivergence(divergence);
        setDetailDialogOpen(true);
    };

    const handleReconcile = (divergence: Divergence) => {
        setSelectedDivergence(divergence);
        setActionKind(getActionForDivergence(divergence));
        setPrefillLocalSubscriptionId(null);
        setActionDialogOpen(true);
    };

    const handleUseCandidate = (localSubscriptionId: string) => {
        if (!selectedDivergence) return;
        setActionKind(getActionForDivergence(selectedDivergence));
        setPrefillLocalSubscriptionId(localSubscriptionId);
        setDetailDialogOpen(false);
        setActionDialogOpen(true);
    };

    const handleKindFilterChange = (value: DivergenceKind | 'all') => {
        setKindFilter(value);
        setPage(1);
    };

    const handleSinceChange = (value: string) => {
        setSinceDate(value);
        setPage(1);
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.reconciliation.title')}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('admin-billing.reconciliation.description')}
                    </p>
                </div>

                {/* truncated banner — MUST be prominent (HOS-765 spec note 3) */}
                <TruncatedBanner truncated={report?.truncated ?? false} />

                {/* filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.reconciliation.filters.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="reconciliation-kind-filter">
                                    {t('admin-billing.reconciliation.filters.kindLabel')}
                                </Label>
                                <select
                                    id="reconciliation-kind-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={kindFilter}
                                    onChange={(e) =>
                                        handleKindFilterChange(
                                            e.target.value as DivergenceKind | 'all'
                                        )
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.reconciliation.filters.allKinds')}
                                    </option>
                                    <option value="unrecorded-payment">
                                        {t('admin-billing.reconciliation.kinds.unrecordedPayment')}
                                    </option>
                                    <option value="orphan-preapproval">
                                        {t('admin-billing.reconciliation.kinds.orphanPreapproval')}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="reconciliation-since">
                                    {t('admin-billing.reconciliation.filters.sinceLabel')}
                                </Label>
                                <Input
                                    id="reconciliation-since"
                                    type="date"
                                    value={sinceDate}
                                    onChange={(e) => handleSinceChange(e.target.value)}
                                />
                                <p className="mt-1 text-muted-foreground text-xs">
                                    {t('admin-billing.reconciliation.filters.sinceHint')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <DivergenceTable
                    divergences={divergences}
                    isLoading={isLoading}
                    isError={isError}
                    onViewDetails={handleViewDetails}
                    onReconcile={handleReconcile}
                />

                {/* pagination + MP call diagnostics */}
                {report && (
                    <div className="flex flex-wrap items-center justify-between gap-4 text-muted-foreground text-xs">
                        <span>
                            {t('admin-billing.reconciliation.mpCallStats', {
                                calls: report.mpCallCount,
                                rateLimited: report.mpRateLimitedCount
                            })}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!report.pagination.hasPreviousPage}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                {t('admin-billing.reconciliation.pagination.previous')}
                            </Button>
                            <span>
                                {t('admin-billing.reconciliation.pagination.pageOf', {
                                    page: report.pagination.page,
                                    totalPages: report.pagination.totalPages
                                })}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!report.pagination.hasNextPage}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('admin-billing.reconciliation.pagination.next')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Dialogs */}
            <DivergenceDetailDialog
                divergence={selectedDivergence}
                open={detailDialogOpen}
                onOpenChange={setDetailDialogOpen}
                onUseCandidate={handleUseCandidate}
            />

            <ReconcileActionDialog
                divergence={selectedDivergence}
                action={actionKind}
                open={actionDialogOpen}
                onOpenChange={setActionDialogOpen}
                prefillLocalSubscriptionId={prefillLocalSubscriptionId}
                forceLinkMutation={forceLinkMutation}
                backfillMutation={backfillMutation}
                addToast={addToast}
            />
        </SidebarPageLayout>
    );
}
