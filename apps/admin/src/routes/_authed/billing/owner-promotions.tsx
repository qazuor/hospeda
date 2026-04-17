/**
 * Owner Promotions Management Page
 *
 * Manages special promotions offered by accommodation owners
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    useDeleteOwnerPromotionMutation,
    useOwnerPromotionsQuery,
    useUpdatePromotionLifecycleMutation
} from '@/features/owner-promotions/hooks';
import type { OwnerPromotion } from '@/features/owner-promotions/types';
import { useTranslations } from '@/hooks/use-translations';
import { EntitlementGate, LimitGate } from '@qazuor/qzpay-react';
import { AddIcon } from '@repo/icons';
import { LifecycleStatusEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { PromotionDetailDialog } from '@/features/owner-promotions/components/PromotionDetailDialog';
import { PromotionFormDialog } from '@/features/owner-promotions/components/PromotionFormDialog';

export const Route = createFileRoute('/_authed/billing/owner-promotions')({
    component: BillingOwnerPromotionsPage
});

function BillingOwnerPromotionsPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        lifecycleState?: LifecycleStatusEnum;
        discountType?: string;
    }>({});
    const [selectedPromotion, setSelectedPromotion] = useState<OwnerPromotion | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    const { data, isLoading, error } = useOwnerPromotionsQuery({
        page,
        pageSize,
        ...filters
    });

    const updateLifecycleMutation = useUpdatePromotionLifecycleMutation();
    const deleteMutation = useDeleteOwnerPromotionMutation();

    const handleLifecycleChange = (
        promotion: OwnerPromotion,
        lifecycleState: LifecycleStatusEnum
    ) => {
        updateLifecycleMutation.mutate({
            id: promotion.id,
            lifecycleState
        });
    };

    const handleEdit = (promotion: OwnerPromotion) => {
        setSelectedPromotion(promotion);
        setEditDialogOpen(true);
    };

    const handleDelete = (promotion: OwnerPromotion) => {
        if (confirm(`${t('admin-billing.ownerPromotions.confirmDelete')} "${promotion.title}"?`)) {
            deleteMutation.mutate(promotion.id);
        }
    };

    const handleViewDetails = (promotion: OwnerPromotion) => {
        setSelectedPromotion(promotion);
        setDetailDialogOpen(true);
    };

    const columns: DataTableColumn<OwnerPromotion>[] = [
        {
            id: 'title',
            header: t('admin-billing.ownerPromotions.columns.title'),
            accessorKey: 'title',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'ownerId',
            header: t('admin-billing.ownerPromotions.columns.owner'),
            accessorKey: 'ownerId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'accommodationId',
            header: t('admin-billing.ownerPromotions.columns.accommodation'),
            accessorKey: 'accommodationId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'discountType',
            header: t('admin-billing.ownerPromotions.columns.type'),
            accessorKey: 'discountType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'PERCENTAGE',
                    label: t('admin-billing.ownerPromotions.discountTypes.percentage'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'FIXED_AMOUNT',
                    label: t('admin-billing.ownerPromotions.discountTypes.fixedAmount'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'FREE_NIGHT',
                    label: t('admin-billing.ownerPromotions.discountTypes.freeNight'),
                    color: BadgeColor.PURPLE
                },
                {
                    value: 'SPECIAL_PRICE',
                    label: t('admin-billing.ownerPromotions.discountTypes.specialPrice'),
                    color: BadgeColor.ORANGE
                }
            ]
        },
        {
            id: 'discountValue',
            header: t('admin-billing.ownerPromotions.columns.value'),
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'status',
            header: t('admin-billing.ownerPromotions.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge
                    variant={
                        row.lifecycleState === 'ACTIVE'
                            ? 'success'
                            : row.lifecycleState === 'DRAFT'
                              ? 'secondary'
                              : 'outline'
                    }
                >
                    {row.lifecycleState === 'ACTIVE'
                        ? t('admin-billing.ownerPromotions.statusActive')
                        : row.lifecycleState === 'DRAFT'
                          ? t('admin-billing.ownerPromotions.statusDraft')
                          : t('admin-billing.ownerPromotions.statusArchived')}
                </Badge>
            )
        },
        {
            id: 'validFrom',
            header: t('admin-billing.ownerPromotions.columns.validFrom'),
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'validUntil',
            header: t('admin-billing.ownerPromotions.columns.validUntil'),
            accessorKey: 'validUntil',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'redemptions',
            header: t('admin-billing.ownerPromotions.columns.usage'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.currentRedemptions} / {row.maxRedemptions || '\u221E'}
                </span>
            )
        },
        {
            id: 'actions',
            header: t('admin-billing.ownerPromotions.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(row)}
                    >
                        {t('admin-billing.ownerPromotions.actions.view')}
                    </Button>
                    <select
                        aria-label={t('admin-billing.ownerPromotions.actions.changeLifecycle')}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={row.lifecycleState}
                        onChange={(e) =>
                            handleLifecycleChange(row, e.target.value as LifecycleStatusEnum)
                        }
                        disabled={updateLifecycleMutation.isPending}
                    >
                        <option value={LifecycleStatusEnum.DRAFT}>
                            {t('admin-billing.ownerPromotions.statusDraft')}
                        </option>
                        <option value={LifecycleStatusEnum.ACTIVE}>
                            {t('admin-billing.ownerPromotions.statusActive')}
                        </option>
                        <option value={LifecycleStatusEnum.ARCHIVED}>
                            {t('admin-billing.ownerPromotions.statusArchived')}
                        </option>
                    </select>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(row)}
                    >
                        {t('admin-billing.ownerPromotions.actions.edit')}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(row)}
                        disabled={deleteMutation.isPending}
                    >
                        {t('admin-billing.ownerPromotions.actions.delete')}
                    </Button>
                </div>
            )
        }
    ];

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                {t('admin-billing.ownerPromotions.loadError')}
                            </p>
                            <p className="mt-2 text-red-600 text-sm dark:text-red-400">
                                {error.message}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </SidebarPageLayout>
        );
    }

    const promotions = (data?.items as OwnerPromotion[] | undefined) ?? [];
    const total = (data?.pagination?.total as number | undefined) ?? 0;

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.ownerPromotions.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.ownerPromotions.description')}
                    </p>
                </div>

                {/* Filters and actions */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={filters.lifecycleState ?? 'all'}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    lifecycleState:
                                        e.target.value === 'all'
                                            ? undefined
                                            : (e.target.value as LifecycleStatusEnum)
                                }))
                            }
                        >
                            <option value="all">
                                {t('admin-billing.ownerPromotions.filters.allStatuses')}
                            </option>
                            <option value={LifecycleStatusEnum.DRAFT}>
                                {t('admin-billing.ownerPromotions.statusDraft')}
                            </option>
                            <option value={LifecycleStatusEnum.ACTIVE}>
                                {t('admin-billing.ownerPromotions.statusActive')}
                            </option>
                            <option value={LifecycleStatusEnum.ARCHIVED}>
                                {t('admin-billing.ownerPromotions.statusArchived')}
                            </option>
                        </select>

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={filters.discountType || 'all'}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    discountType:
                                        e.target.value === 'all' ? undefined : e.target.value
                                }))
                            }
                        >
                            <option value="all">
                                {t('admin-billing.ownerPromotions.filters.allTypes')}
                            </option>
                            <option value="PERCENTAGE">
                                {t('admin-billing.ownerPromotions.discountTypes.percentage')}
                            </option>
                            <option value="FIXED_AMOUNT">
                                {t('admin-billing.ownerPromotions.discountTypes.fixedAmount')}
                            </option>
                            <option value="FREE_NIGHT">
                                {t('admin-billing.ownerPromotions.discountTypes.freeNight')}
                            </option>
                            <option value="SPECIAL_PRICE">
                                {t('admin-billing.ownerPromotions.discountTypes.specialPrice')}
                            </option>
                        </select>
                    </div>

                    <EntitlementGate
                        entitlementKey="create-promotions"
                        fallback={
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                                <p className="font-medium text-amber-900">
                                    {t('admin-billing.ownerPromotions.entitlementGate')}
                                </p>
                            </div>
                        }
                    >
                        <LimitGate
                            limitKey="max_active_promotions"
                            fallback={
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                                    <p className="font-medium text-amber-900">
                                        {t('admin-billing.ownerPromotions.limitGateTitle')}
                                    </p>
                                    <p className="mt-1 text-amber-800 text-xs">
                                        {t('admin-billing.ownerPromotions.limitGateDescription')}
                                    </p>
                                </div>
                            }
                        >
                            <Button onClick={() => setCreateDialogOpen(true)}>
                                <AddIcon className="mr-2 h-4 w-4" />
                                {t('admin-billing.ownerPromotions.createButton')}
                            </Button>
                        </LimitGate>
                    </EntitlementGate>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={promotions}
                    total={total}
                    rowId={(row) => row.id}
                    loading={isLoading}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    sort={[]}
                    onSortChange={() => {}}
                    columnVisibility={{}}
                    onColumnVisibilityChange={() => {}}
                />

                {/* Dialogs */}
                <PromotionFormDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    promotion={null}
                    mode="create"
                />

                <PromotionFormDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    promotion={selectedPromotion}
                    mode="edit"
                />

                <PromotionDetailDialog
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    promotion={selectedPromotion}
                />
            </div>
        </SidebarPageLayout>
    );
}
