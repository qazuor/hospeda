/**
 * Billing Plans Management Page
 *
 * Manages subscription plans for owners, complexes, and tourists.
 * Supports creating, editing, toggling active state, and soft-deleting plans.
 * All write operations hit the live admin API endpoints via TanStack Query
 * mutations; the `id` (UUID) is the mutation identifier per SPEC-168 D1.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumn } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    type CreatePlanPayload,
    HardDeleteConfirmDialog,
    type ParsedPlanRecord,
    PlanDialog,
    SoftDeleteConfirmDialog,
    getPlanColumns,
    useCreatePlanMutation,
    useDeletePlanMutation,
    useHardDeletePlanMutation,
    usePlansQuery,
    useRestorePlanMutation,
    useTogglePlanActiveMutation,
    useUpdatePlanMutation
} from '@/features/billing-plans';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';
import { getFriendlyErrorInfo, isApiError, reportError } from '@/lib/errors';
import { AddIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/billing/plans')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
    component: BillingPlansPage
});

type PlanCategory = 'all' | 'owner' | 'complex' | 'tourist';

function BillingPlansPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [categoryFilter, setCategoryFilter] = useState<PlanCategory>('all');
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<ParsedPlanRecord | null>(null);
    // Plan pending a soft-delete confirmation (shows subscriber impact).
    const [planToSoftDelete, setPlanToSoftDelete] = useState<ParsedPlanRecord | null>(null);
    // Plan pending a permanent-delete confirmation.
    const [planToHardDelete, setPlanToHardDelete] = useState<ParsedPlanRecord | null>(null);

    // Fetch plans from the DB-backed API endpoint
    const { data, isLoading, error } = usePlansQuery({
        page,
        pageSize,
        category: categoryFilter,
        includeDeleted
    });

    const toggleActiveMutation = useTogglePlanActiveMutation();
    const deleteMutation = useDeletePlanMutation();
    const restoreMutation = useRestorePlanMutation();
    const hardDeleteMutation = useHardDeletePlanMutation();
    const createMutation = useCreatePlanMutation();
    const updateMutation = useUpdatePlanMutation();

    // Report query errors to Sentry once per occurrence
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

    const plans = Array.isArray(data?.items) ? data.items : [];
    const total = (data?.pagination?.total as number | undefined) ?? plans.length;

    /**
     * Opens the dialog in create mode (no editing plan).
     */
    const handleCreateNew = () => {
        setEditingPlan(null);
        setDialogOpen(true);
    };

    /**
     * Opens the dialog in edit mode with the given plan pre-filled.
     * Uses the plan's `id` (UUID) as the mutation identifier (D1).
     */
    const handleEdit = (plan: ParsedPlanRecord) => {
        setEditingPlan(plan);
        setDialogOpen(true);
    };

    /**
     * Handles dialog form submission — dispatches create or update mutation
     * depending on whether `editingPlan` is set.
     *
     * @param payload - Form payload from PlanDialog.
     */
    const handleSubmit = async (payload: CreatePlanPayload) => {
        if (editingPlan) {
            // Update: use id (UUID) as the mutation identifier per D1.
            // slug is stripped from the payload (immutable after creation).
            const { slug: _slug, ...updateFields } = payload;
            await updateMutation.mutateAsync({ id: editingPlan.id, ...updateFields });
        } else {
            await createMutation.mutateAsync(payload);
        }
    };

    /**
     * Toggles active state for a plan by UUID (D1: id-based mutations).
     */
    const handleToggleActive = (id: string, isActive: boolean) => {
        const message = isActive
            ? t('admin-billing.plans.confirmActivate')
            : t('admin-billing.plans.confirmDeactivate');
        if (confirm(message)) {
            toggleActiveMutation.mutate({ id, isActive });
        }
    };

    /**
     * Opens the soft-delete confirmation dialog for the given plan. The dialog
     * surfaces the plan's live subscriber count before the destructive action.
     */
    const handleDelete = (plan: ParsedPlanRecord) => {
        setPlanToSoftDelete(plan);
    };

    /**
     * Confirms the pending soft-delete (D1: id-based mutations).
     */
    const confirmSoftDelete = () => {
        if (!planToSoftDelete) return;
        deleteMutation.mutate(planToSoftDelete.id, {
            onSuccess: () => {
                addToast({
                    title: t('admin-billing.plans.toastDeletedTitle'),
                    message: t('admin-billing.plans.toastDeletedMessage'),
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                addToast({
                    title: t('admin-billing.plans.toastErrorTitle'),
                    message:
                        mutationError instanceof Error
                            ? mutationError.message
                            : t('admin-billing.plans.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
        setPlanToSoftDelete(null);
    };

    /**
     * Restores a soft-deleted plan by UUID.
     */
    const handleRestore = (plan: ParsedPlanRecord) => {
        restoreMutation.mutate(plan.id, {
            onSuccess: () => {
                addToast({
                    title: t('admin-billing.plans.toastRestoredTitle'),
                    message: t('admin-billing.plans.toastRestoredMessage'),
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                addToast({
                    title: t('admin-billing.plans.toastErrorTitle'),
                    message:
                        mutationError instanceof Error
                            ? mutationError.message
                            : t('admin-billing.plans.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
    };

    /**
     * Opens the permanent-delete confirmation dialog for a soft-deleted plan.
     */
    const handleHardDelete = (plan: ParsedPlanRecord) => {
        setPlanToHardDelete(plan);
    };

    /**
     * Confirms the pending permanent-delete. A 409 from the API (plan still
     * referenced by subscriptions) is mapped to a specific "blocked" toast.
     */
    const confirmHardDelete = () => {
        if (!planToHardDelete) return;
        hardDeleteMutation.mutate(planToHardDelete.id, {
            onSuccess: () => {
                addToast({
                    title: t('admin-billing.plans.toastHardDeletedTitle'),
                    message: t('admin-billing.plans.toastHardDeletedMessage'),
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                const blocked = isApiError(mutationError) && mutationError.status === 409;
                addToast({
                    title: t('admin-billing.plans.toastErrorTitle'),
                    message: blocked
                        ? t('admin-billing.plans.hardDeleteBlocked')
                        : mutationError instanceof Error
                          ? mutationError.message
                          : t('admin-billing.plans.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
        setPlanToHardDelete(null);
    };

    const columns = getPlanColumns({
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
        onDelete: handleDelete,
        onRestore: handleRestore,
        onHardDelete: handleHardDelete,
        isTogglingActive: toggleActiveMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isRestoring: restoreMutation.isPending,
        isHardDeleting: hardDeleteMutation.isPending,
        t: t as (key: string) => string
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <PageHeader onCreateNew={handleCreateNew} />

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="font-medium text-destructive">
                                    {friendlyError?.title ?? t('admin-billing.plans.apiLoadError')}
                                </p>
                                <p className="mt-1 text-destructive text-sm">
                                    {friendlyError?.description ?? ''}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

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
                <PageHeader onCreateNew={handleCreateNew} />

                <PlansTable
                    plans={plans}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    columns={columns}
                    isLoading={isLoading}
                    categoryFilter={categoryFilter}
                    includeDeleted={includeDeleted}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onCategoryFilterChange={setCategoryFilter}
                    onIncludeDeletedChange={setIncludeDeleted}
                />

                <PlanDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    plan={editingPlan}
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                />

                <SoftDeleteConfirmDialog
                    plan={planToSoftDelete}
                    onCancel={() => setPlanToSoftDelete(null)}
                    onConfirm={confirmSoftDelete}
                />

                <HardDeleteConfirmDialog
                    plan={planToHardDelete}
                    onCancel={() => setPlanToHardDelete(null)}
                    onConfirm={confirmHardDelete}
                />
            </div>
        </SidebarPageLayout>
    );
}

interface PageHeaderProps {
    onCreateNew: () => void;
}

/**
 * Page header with title, description, and "Create New Plan" button.
 */
function PageHeader({ onCreateNew }: PageHeaderProps) {
    const { t } = useTranslations();

    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="mb-2 font-bold text-2xl">{t('admin-billing.plans.title')}</h1>
                <p className="text-muted-foreground">{t('admin-billing.plans.description')}</p>
            </div>
            <Button
                onClick={onCreateNew}
                size="sm"
            >
                <AddIcon className="mr-2 h-4 w-4" />
                {t('admin-billing.plans.createPlan')}
            </Button>
        </div>
    );
}

interface PlansTableProps {
    plans: readonly ParsedPlanRecord[];
    total: number;
    page: number;
    pageSize: number;
    columns: ReadonlyArray<DataTableColumn<ParsedPlanRecord>>;
    isLoading: boolean;
    categoryFilter: PlanCategory;
    includeDeleted: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onCategoryFilterChange: (filter: PlanCategory) => void;
    onIncludeDeletedChange: (value: boolean) => void;
}

function PlansTable({
    plans,
    total,
    page,
    pageSize,
    columns,
    isLoading,
    categoryFilter,
    includeDeleted,
    onPageChange,
    onPageSizeChange,
    onCategoryFilterChange,
    onIncludeDeletedChange
}: PlansTableProps) {
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            {/* Category filter + show-deleted toggle */}
            <div className="flex items-center gap-4">
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

                <div className="flex items-center gap-2 text-sm">
                    <Switch
                        id="plans-show-deleted"
                        checked={includeDeleted}
                        onCheckedChange={onIncludeDeletedChange}
                        aria-label={t('admin-billing.plans.showDeleted')}
                    />
                    <Label htmlFor="plans-show-deleted">
                        {t('admin-billing.plans.showDeleted')}
                    </Label>
                </div>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={plans}
                total={total}
                rowId={(row) => row.id}
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
