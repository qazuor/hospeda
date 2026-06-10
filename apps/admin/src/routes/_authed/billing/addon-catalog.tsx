/**
 * Billing Add-on Catalog Management Page (SPEC-192 T-021)
 *
 * Manages add-on catalog entries (definitions) from the database.
 * Supports creating, editing, toggling active state, soft-deleting,
 * restoring, and permanently deleting add-on definitions.
 *
 * All write operations hit the new CRUD admin API endpoints via TanStack Query
 * mutations; the `id` (UUID) is the mutation identifier.
 *
 * This page is distinct from `/billing/addons` which manages purchased
 * (customer) add-ons.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumn } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    AddonDialog,
    AddonHardDeleteConfirmDialog,
    AddonSoftDeleteConfirmDialog,
    type CreateAddonPayload,
    type ParsedAddonRecord,
    type UpdateAddonPayload,
    getAddonCatalogColumns,
    useAddonCatalogQuery,
    useCreateAddonMutation,
    useDeleteAddonMutation,
    useHardDeleteAddonMutation,
    useRestoreAddonMutation,
    useToggleAddonActiveMutation,
    useUpdateAddonMutation
} from '@/features/billing-addons';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { requireBillingAccess } from '@/lib/billing-access';
import { getFriendlyErrorInfo, isApiError, reportError } from '@/lib/errors';
import type { AddonDefinition } from '@repo/billing';
import { AddIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/billing/addon-catalog')({
    beforeLoad: ({ context }) => requireBillingAccess(context),
    component: BillingAddonCatalogPage
});

type BillingTypeFilter = 'all' | 'one_time' | 'recurring';

function BillingAddonCatalogPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [billingTypeFilter, setBillingTypeFilter] = useState<BillingTypeFilter>('all');
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAddon, setEditingAddon] = useState<ParsedAddonRecord | null>(null);
    const [addonToSoftDelete, setAddonToSoftDelete] = useState<ParsedAddonRecord | null>(null);
    const [addonToHardDelete, setAddonToHardDelete] = useState<ParsedAddonRecord | null>(null);

    // Fetch catalog from the DB-backed API endpoint
    const { data, isLoading, error } = useAddonCatalogQuery({
        page,
        pageSize,
        billingType: billingTypeFilter !== 'all' ? billingTypeFilter : undefined,
        includeDeleted
    });

    const toggleActiveMutation = useToggleAddonActiveMutation();
    const deleteMutation = useDeleteAddonMutation();
    const restoreMutation = useRestoreAddonMutation();
    const hardDeleteMutation = useHardDeleteAddonMutation();
    const createMutation = useCreateAddonMutation();
    const updateMutation = useUpdateAddonMutation();

    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'BillingAddonCatalogPage',
                tags: { feature: 'billing', surface: 'addon-catalog-list' }
            });
        }
    }, [error]);

    const friendlyError = error ? getFriendlyErrorInfo(error) : null;

    const addons = Array.isArray(data?.items) ? (data.items as ParsedAddonRecord[]) : [];
    const total = (data?.pagination?.total as number | undefined) ?? addons.length;

    /**
     * Opens the dialog in create mode.
     */
    const handleCreateNew = () => {
        setEditingAddon(null);
        setDialogOpen(true);
    };

    /**
     * Opens the dialog in edit mode with the given addon pre-filled.
     */
    const handleEdit = (addon: ParsedAddonRecord) => {
        setEditingAddon(addon);
        setDialogOpen(true);
    };

    /**
     * Handles dialog form submission — dispatches create or update mutation.
     */
    const handleSubmit = async (payload: CreateAddonPayload) => {
        if (editingAddon) {
            const { slug: _slug, ...updateFields } = payload;
            const updatePayload: UpdateAddonPayload = { id: editingAddon.id, ...updateFields };
            await updateMutation.mutateAsync(updatePayload);
        } else {
            await createMutation.mutateAsync(payload);
        }
    };

    /**
     * Toggles active state for an addon by UUID.
     */
    const handleToggleActive = (id: string, isActive: boolean) => {
        // Use a simple confirmation message (no i18n required for confirm dialog)
        const message = isActive ? 'Activate this add-on?' : 'Deactivate this add-on?';
        if (confirm(message)) {
            toggleActiveMutation.mutate({ id, isActive });
        }
    };

    /**
     * Opens the soft-delete confirmation dialog.
     */
    const handleDelete = (addon: ParsedAddonRecord) => {
        setAddonToSoftDelete(addon);
    };

    /**
     * Confirms the pending soft-delete.
     */
    const confirmSoftDelete = () => {
        if (!addonToSoftDelete) return;
        deleteMutation.mutate(addonToSoftDelete.id, {
            onSuccess: () => {
                addToast({
                    title: 'Add-on deleted',
                    message: 'The add-on has been soft-deleted and can be restored.',
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                addToast({
                    title: t('admin-billing.addons.toastErrorTitle'),
                    message:
                        mutationError instanceof Error
                            ? mutationError.message
                            : t('admin-billing.addons.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
        setAddonToSoftDelete(null);
    };

    /**
     * Restores a soft-deleted addon by UUID.
     */
    const handleRestore = (addon: ParsedAddonRecord) => {
        restoreMutation.mutate(addon.id, {
            onSuccess: () => {
                addToast({
                    title: 'Add-on restored',
                    message: 'The add-on has been restored and is now active.',
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                addToast({
                    title: t('admin-billing.addons.toastErrorTitle'),
                    message:
                        mutationError instanceof Error
                            ? mutationError.message
                            : t('admin-billing.addons.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
    };

    /**
     * Opens the permanent-delete confirmation dialog.
     */
    const handleHardDelete = (addon: ParsedAddonRecord) => {
        setAddonToHardDelete(addon);
    };

    /**
     * Confirms the pending permanent-delete.
     * A 409 from the API (addon still referenced by purchases) is mapped to a specific toast.
     */
    const confirmHardDelete = () => {
        if (!addonToHardDelete) return;
        hardDeleteMutation.mutate(addonToHardDelete.id, {
            onSuccess: () => {
                addToast({
                    title: 'Add-on permanently deleted',
                    message: 'The add-on has been permanently removed.',
                    variant: 'success'
                });
            },
            onError: (mutationError) => {
                const blocked = isApiError(mutationError) && mutationError.status === 409;
                addToast({
                    title: t('admin-billing.addons.toastErrorTitle'),
                    message: blocked
                        ? 'Cannot delete: this add-on is referenced by purchase records.'
                        : mutationError instanceof Error
                          ? mutationError.message
                          : t('admin-billing.addons.toastErrorMessage'),
                    variant: 'error'
                });
            }
        });
        setAddonToHardDelete(null);
    };

    const columns = getAddonCatalogColumns({
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
                    <PageHeader
                        onCreateNew={handleCreateNew}
                        t={t as (key: string) => string}
                    />

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="font-medium text-destructive">
                                    {friendlyError?.title ?? 'Failed to load add-on catalog'}
                                </p>
                                <p className="mt-1 text-destructive text-sm">
                                    {friendlyError?.description ?? ''}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <PageHeader
                    onCreateNew={handleCreateNew}
                    t={t as (key: string) => string}
                />

                <CatalogTable
                    addons={addons}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    columns={columns}
                    isLoading={isLoading}
                    billingTypeFilter={billingTypeFilter}
                    includeDeleted={includeDeleted}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onBillingTypeFilterChange={setBillingTypeFilter}
                    onIncludeDeletedChange={setIncludeDeleted}
                    t={t as (key: string) => string}
                />

                <AddonDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    addon={
                        editingAddon
                            ? // Cast via unknown to AddonDefinition: ParsedAddonRecord has all
                              // required fields but uses looser string types for branded keys.
                              // The dialog only reads these values for form defaults, so the cast is safe.
                              ({
                                  slug: editingAddon.slug,
                                  name: editingAddon.name,
                                  description: editingAddon.description,
                                  billingType: editingAddon.billingType,
                                  priceArs: editingAddon.priceArs,
                                  annualPriceArs: null,
                                  durationDays: editingAddon.durationDays,
                                  affectsLimitKey: editingAddon.affectsLimitKey,
                                  limitIncrease: editingAddon.limitIncrease,
                                  grantsEntitlement: editingAddon.grantsEntitlement,
                                  targetCategories: editingAddon.targetCategories,
                                  isActive: editingAddon.isActive,
                                  sortOrder: editingAddon.sortOrder
                                  // TYPE-WORKAROUND: ParsedAddonRecord has all AddonDefinition fields
                                  // but with plain string types instead of branded keys; the dialog
                                  // only reads these values for form defaults, so the cast is safe.
                              } as unknown as AddonDefinition)
                            : null
                    }
                    onSubmit={handleSubmit}
                    isSubmitting={createMutation.isPending || updateMutation.isPending}
                />

                <AddonSoftDeleteConfirmDialog
                    addon={addonToSoftDelete}
                    onCancel={() => setAddonToSoftDelete(null)}
                    onConfirm={confirmSoftDelete}
                    t={t as (key: string) => string}
                />

                <AddonHardDeleteConfirmDialog
                    addon={addonToHardDelete}
                    onCancel={() => setAddonToHardDelete(null)}
                    onConfirm={confirmHardDelete}
                    t={t as (key: string) => string}
                />
            </div>
        </SidebarPageLayout>
    );
}

interface PageHeaderProps {
    onCreateNew: () => void;
    t: (key: string) => string;
}

function PageHeader({ onCreateNew, t: _t }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="mb-2 font-bold text-2xl">Add-on Catalog</h1>
                <p className="text-muted-foreground">
                    Manage add-on definitions available for purchase.
                </p>
            </div>
            <Button
                onClick={onCreateNew}
                size="sm"
            >
                <AddIcon className="mr-2 h-4 w-4" />
                New Add-on
            </Button>
        </div>
    );
}

interface CatalogTableProps {
    addons: readonly ParsedAddonRecord[];
    total: number;
    page: number;
    pageSize: number;
    columns: ReadonlyArray<DataTableColumn<ParsedAddonRecord>>;
    isLoading: boolean;
    billingTypeFilter: BillingTypeFilter;
    includeDeleted: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onBillingTypeFilterChange: (filter: BillingTypeFilter) => void;
    onIncludeDeletedChange: (value: boolean) => void;
    t: (key: string) => string;
}

function CatalogTable({
    addons,
    total,
    page,
    pageSize,
    columns,
    isLoading,
    billingTypeFilter,
    includeDeleted,
    onPageChange,
    onPageSizeChange,
    onBillingTypeFilterChange,
    onIncludeDeletedChange,
    t
}: CatalogTableProps) {
    return (
        <div className="space-y-4">
            {/* Billing type filter + show-deleted toggle */}
            <div className="flex items-center gap-4">
                <select
                    aria-label="All billing types"
                    className="rounded-md border px-3 py-2 text-sm"
                    value={billingTypeFilter}
                    onChange={(e) => onBillingTypeFilterChange(e.target.value as BillingTypeFilter)}
                >
                    <option value="all">All types</option>
                    <option value="one_time">
                        {t('admin-billing.addons.billingTypeLabels.oneTime')}
                    </option>
                    <option value="recurring">
                        {t('admin-billing.addons.billingTypeLabels.recurring')}
                    </option>
                </select>

                <div className="flex items-center gap-2 text-sm">
                    <Switch
                        id="addon-catalog-show-deleted"
                        checked={includeDeleted}
                        onCheckedChange={onIncludeDeletedChange}
                        aria-label="Show deleted add-ons"
                    />
                    <Label htmlFor="addon-catalog-show-deleted">Show deleted</Label>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={addons}
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
