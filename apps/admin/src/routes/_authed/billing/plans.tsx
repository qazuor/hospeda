/**
 * Billing Plans Management Page
 *
 * Manages subscription plans for owners, complexes, and tourists.
 * Supports viewing plan details, entitlements, limits, and pricing.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumn } from '@/components/table/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import {
    type CreatePlanPayload,
    type PlanDefinition,
    PlanDialog,
    getPlanColumns,
    useCreatePlanMutation,
    useDeletePlanMutation,
    usePlansQuery,
    useTogglePlanActiveMutation,
    useUpdatePlanMutation
} from '@/features/billing-plans';
import { useTranslations } from '@/hooks/use-translations';
import { getFriendlyErrorInfo, reportError } from '@/lib/errors';
import { ALL_PLANS } from '@repo/billing';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/billing/plans')({
    component: BillingPlansPage
});

type PlanCategory = 'all' | 'owner' | 'complex' | 'tourist';

function BillingPlansPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [categoryFilter, setCategoryFilter] = useState<PlanCategory>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    // Plans are read-only; editingPlan stays null but kept for PlanDialog props compat.
    const [editingPlan] = useState<PlanDefinition | null>(null);

    // Fetch plans from API
    // NOTE: Currently using static data from @repo/billing as fallback
    // until qzpay-hono billing API routes are implemented
    const { data, isLoading, error } = usePlansQuery({
        page,
        limit: pageSize,
        category: categoryFilter
    });

    const toggleActiveMutation = useTogglePlanActiveMutation();
    const deleteMutation = useDeletePlanMutation();
    const createMutation = useCreatePlanMutation();
    const updateMutation = useUpdatePlanMutation();

    // Report query errors to Sentry once per occurrence (the transform layer
    // also reports its own ApiError, but plain network/HTTP errors only land
    // here).
    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'BillingPlansPage',
                tags: { feature: 'billing', surface: 'plans-list' }
            });
        }
    }, [error]);

    const friendlyError = error ? getFriendlyErrorInfo(error) : null;

    // Use API data if available, otherwise fall back to static config
    const hasApiData = Array.isArray(data?.items) && data.items.length > 0;
    // TYPE-WORKAROUND: API returns ParsedPlanRecord[] which is structurally
    // compatible with PlanDefinition at runtime but exposes different branded
    // types for entitlements/limits. Branded mismatches are a TS-only concern;
    // fallback to ALL_PLANS protects on shape divergence at the array level.
    const plans = hasApiData ? (data.items as unknown as PlanDefinition[]) : ALL_PLANS;
    const total = hasApiData
        ? ((data?.pagination?.total as number | undefined) ?? plans.length)
        : ALL_PLANS.length;

    // When using static fallback, never show loading state
    const effectiveLoading = hasApiData ? isLoading : false;

    // Apply client-side filtering if using static data
    const filteredPlans = hasApiData
        ? plans
        : (ALL_PLANS as readonly PlanDefinition[]).filter((plan: PlanDefinition) => {
              if (categoryFilter === 'all') return true;
              return plan.category === categoryFilter;
          });

    // Plan write operations are intentionally disabled.
    // Plans are managed as code in packages/billing/src/config/plans.config.ts
    // (single source of truth). See ADR-020. Create/edit/delete are stubs that
    // surface a clear message instead of hitting nonexistent endpoints.
    const handleCreateNew = () => {
        alert(t('admin-billing.plans.apiRequired'));
    };

    const handleEdit = (_plan: PlanDefinition) => {
        alert(t('admin-billing.plans.apiRequired'));
    };

    const handleSubmit = async (_payload: CreatePlanPayload) => {
        // No-op. Dialog never opens for write operations.
        alert(t('admin-billing.plans.apiRequired'));
    };

    const handleToggleActive = (id: string, isActive: boolean) => {
        if (!hasApiData) {
            alert(t('admin-billing.plans.apiRequired'));
            return;
        }

        const message = isActive
            ? t('admin-billing.plans.confirmActivate')
            : t('admin-billing.plans.confirmDeactivate');
        if (confirm(message)) {
            toggleActiveMutation.mutate({ id, isActive });
        }
    };

    const handleDelete = (id: string) => {
        if (!hasApiData) {
            alert(t('admin-billing.plans.apiRequired'));
            return;
        }

        if (confirm(t('admin-billing.plans.confirmDelete'))) {
            deleteMutation.mutate(id);
        }
    };

    const columns = getPlanColumns({
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
        onDelete: handleDelete,
        isTogglingActive: toggleActiveMutation.isPending,
        isDeleting: deleteMutation.isPending,
        t: t as (key: string) => string
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.plans.title')}
                        </h1>
                        <p className="text-muted-foreground">
                            {t('admin-billing.plans.description')}
                        </p>
                    </div>

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="font-medium text-destructive">
                                    {friendlyError?.title ?? t('admin-billing.plans.apiLoadError')}
                                </p>
                                <p className="mt-1 text-destructive text-sm">
                                    {friendlyError?.description ?? ''}
                                </p>
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.plans.staticFallback')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <PlansTable
                        plans={filteredPlans}
                        total={filteredPlans.length}
                        page={page}
                        pageSize={pageSize}
                        columns={columns}
                        isLoading={false}
                        categoryFilter={categoryFilter}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        onCategoryFilterChange={setCategoryFilter}
                        onCreateNew={handleCreateNew}
                    />

                    <PlanDialog
                        open={dialogOpen}
                        onOpenChange={setDialogOpen}
                        plan={editingPlan}
                        onSubmit={handleSubmit}
                        isSubmitting={createMutation.isPending || updateMutation.isPending}
                    />
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.plans.title')}
                        </h1>
                        <p className="text-muted-foreground">
                            {t('admin-billing.plans.description')}
                        </p>
                    </div>
                </div>

                <Card className="border-warning/30 bg-warning/10">
                    <CardContent className="py-4">
                        <p className="text-foreground text-sm">
                            <strong>{t('admin-billing.plans.noteLabel')}</strong>{' '}
                            {t('admin-billing.plans.apiUnavailable')}
                        </p>
                    </CardContent>
                </Card>

                <PlansTable
                    plans={filteredPlans}
                    total={hasApiData ? total : filteredPlans.length}
                    page={page}
                    pageSize={pageSize}
                    columns={columns}
                    isLoading={effectiveLoading}
                    categoryFilter={categoryFilter}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onCategoryFilterChange={setCategoryFilter}
                    onCreateNew={handleCreateNew}
                />

                <PlanDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    plan={editingPlan}
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                />
            </div>
        </SidebarPageLayout>
    );
}

interface PlansTableProps {
    plans: readonly PlanDefinition[];
    total: number;
    page: number;
    pageSize: number;
    columns: ReadonlyArray<DataTableColumn<PlanDefinition>>;
    isLoading: boolean;
    categoryFilter: PlanCategory;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onCategoryFilterChange: (filter: PlanCategory) => void;
    onCreateNew?: () => void;
}

function PlansTable({
    plans,
    total,
    page,
    pageSize,
    columns,
    isLoading,
    categoryFilter,
    onPageChange,
    onPageSizeChange,
    onCategoryFilterChange
}: PlansTableProps) {
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            {/* Filters — Create button intentionally omitted: plans are read-only */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                    <select
                        aria-label={t('admin-billing.plans.allCategories')}
                        className="rounded-md border px-3 py-2 text-sm"
                        value={categoryFilter}
                        onChange={(e) => onCategoryFilterChange(e.target.value as PlanCategory)}
                    >
                        <option value="all">{t('admin-billing.plans.allCategories')}</option>
                        <option value="owner">{t('admin-billing.plans.categoryOwner')}</option>
                        <option value="complex">{t('admin-billing.plans.categoryComplex')}</option>
                        <option value="tourist">{t('admin-billing.plans.categoryTourist')}</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={plans}
                total={total}
                rowId={(row) => row.slug}
                loading={isLoading}
                page={page}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                sort={[]}
                onSortChange={() => {}}
                columnVisibility={{}}
                onColumnVisibilityChange={() => {}}
            />
        </div>
    );
}
