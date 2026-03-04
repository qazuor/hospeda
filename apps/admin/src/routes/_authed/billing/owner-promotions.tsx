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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateOwnerPromotionMutation,
    useDeleteOwnerPromotionMutation,
    useOwnerPromotionsQuery,
    useTogglePromotionActiveMutation,
    useUpdateOwnerPromotionMutation
} from '@/features/owner-promotions/hooks';
import type { CreateOwnerPromotionInput, OwnerPromotion } from '@/features/owner-promotions/types';
import { useTranslations } from '@/hooks/use-translations';
import { EntitlementGate, LimitGate } from '@qazuor/qzpay-react';
import { AddIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/owner-promotions')({
    component: BillingOwnerPromotionsPage
});

function BillingOwnerPromotionsPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        status?: string;
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

    const toggleActiveMutation = useTogglePromotionActiveMutation();
    const deleteMutation = useDeleteOwnerPromotionMutation();

    const handleToggleActive = (promotion: OwnerPromotion) => {
        toggleActiveMutation.mutate({
            id: promotion.id,
            isActive: !promotion.isActive
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
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive
                        ? t('admin-billing.ownerPromotions.statusActive')
                        : t('admin-billing.ownerPromotions.statusInactive')}
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
                    {row.currentRedemptions} / {row.maxRedemptions || '∞'}
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(row)}
                        disabled={toggleActiveMutation.isPending}
                    >
                        {row.isActive
                            ? t('admin-billing.ownerPromotions.actions.deactivate')
                            : t('admin-billing.ownerPromotions.actions.activate')}
                    </Button>
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
                            value={filters.status || 'all'}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value === 'all' ? undefined : e.target.value
                                }))
                            }
                        >
                            <option value="all">
                                {t('admin-billing.ownerPromotions.filters.allStatuses')}
                            </option>
                            <option value="active">
                                {t('admin-billing.ownerPromotions.filters.active')}
                            </option>
                            <option value="inactive">
                                {t('admin-billing.ownerPromotions.filters.inactive')}
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

/**
 * Promotion Form Dialog (Create/Edit)
 */
function PromotionFormDialog({
    open,
    onOpenChange,
    promotion,
    mode
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    promotion: OwnerPromotion | null;
    mode: 'create' | 'edit';
}) {
    const { t } = useTranslations();
    const [formData, setFormData] = useState<CreateOwnerPromotionInput>({
        ownerId: promotion?.ownerId || '',
        accommodationId: promotion?.accommodationId || '',
        title: promotion?.title || '',
        description: promotion?.description || '',
        discountType: promotion?.discountType || 'PERCENTAGE',
        discountValue: promotion?.discountValue || 0,
        minNights: promotion?.minNights || undefined,
        validFrom: promotion?.validFrom || '',
        validUntil: promotion?.validUntil || '',
        maxRedemptions: promotion?.maxRedemptions || undefined,
        isActive: promotion?.isActive ?? true
    });

    const createMutation = useCreateOwnerPromotionMutation();
    const updateMutation = useUpdateOwnerPromotionMutation();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'create') {
            createMutation.mutate(formData, {
                onSuccess: () => {
                    onOpenChange(false);
                }
            });
        } else if (promotion) {
            updateMutation.mutate(
                { ...formData, id: promotion.id },
                {
                    onSuccess: () => {
                        onOpenChange(false);
                    }
                }
            );
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create'
                            ? t('admin-billing.ownerPromotions.form.createTitle')
                            : t('admin-billing.ownerPromotions.form.editTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? t('admin-billing.ownerPromotions.form.createDescription')
                            : t('admin-billing.ownerPromotions.form.editDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">
                                {t('admin-billing.ownerPromotions.form.titleLabel')}
                            </Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                                }
                                required
                                placeholder={t(
                                    'admin-billing.ownerPromotions.form.titlePlaceholder'
                                )}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">
                                {t('admin-billing.ownerPromotions.form.descriptionLabel')}
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: e.target.value
                                    }))
                                }
                                rows={3}
                                placeholder={t(
                                    'admin-billing.ownerPromotions.form.descriptionPlaceholder'
                                )}
                            />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="discountType">
                                    {t('admin-billing.ownerPromotions.form.discountTypeLabel')}
                                </Label>
                                <select
                                    id="discountType"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.discountType}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountType: e.target.value as
                                                | 'PERCENTAGE'
                                                | 'FIXED_AMOUNT'
                                                | 'FREE_NIGHT'
                                                | 'SPECIAL_PRICE'
                                        }))
                                    }
                                >
                                    <option value="PERCENTAGE">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.percentage'
                                        )}
                                    </option>
                                    <option value="FIXED_AMOUNT">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.fixedAmount'
                                        )}
                                    </option>
                                    <option value="FREE_NIGHT">
                                        {t('admin-billing.ownerPromotions.discountTypes.freeNight')}
                                    </option>
                                    <option value="SPECIAL_PRICE">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.specialPrice'
                                        )}
                                    </option>
                                </select>
                            </div>

                            <div>
                                <Label htmlFor="discountValue">
                                    {t('admin-billing.ownerPromotions.form.valueLabel')}
                                </Label>
                                <Input
                                    id="discountValue"
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountValue: Number(e.target.value)
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="validFrom">
                                    {t('admin-billing.ownerPromotions.form.validFromLabel')}
                                </Label>
                                <Input
                                    id="validFrom"
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validFrom: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="validUntil">
                                    {t('admin-billing.ownerPromotions.form.validUntilLabel')}
                                </Label>
                                <Input
                                    id="validUntil"
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validUntil: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('admin-billing.ownerPromotions.form.cancelButton')}
                        </Button>
                        <Button type="submit">
                            {mode === 'create'
                                ? t('admin-billing.ownerPromotions.form.createSubmit')
                                : t('admin-billing.ownerPromotions.form.editSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Promotion Detail Dialog
 */
function PromotionDetailDialog({
    open,
    onOpenChange,
    promotion
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    promotion: OwnerPromotion | null;
}) {
    const { t } = useTranslations();
    if (!promotion) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{promotion.title}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.ownerPromotions.detail.subtitle')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t('admin-billing.ownerPromotions.detail.generalInfo')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.statusLabel')}
                                </span>
                                <Badge variant={promotion.isActive ? 'success' : 'secondary'}>
                                    {promotion.isActive
                                        ? t('admin-billing.ownerPromotions.statusActive')
                                        : t('admin-billing.ownerPromotions.statusInactive')}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.discountTypeLabel')}
                                </span>
                                <span>{promotion.discountType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.valueLabel')}
                                </span>
                                <span>{promotion.discountValue}</span>
                            </div>
                            {promotion.description && (
                                <div>
                                    <p className="mb-1 text-muted-foreground">
                                        {t('admin-billing.ownerPromotions.detail.descriptionLabel')}
                                    </p>
                                    <p>{promotion.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t('admin-billing.ownerPromotions.detail.usageStats')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.currentRedemptions')}
                                </span>
                                <span>{promotion.currentRedemptions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.maxRedemptions')}
                                </span>
                                <span>
                                    {promotion.maxRedemptions ||
                                        t('admin-billing.ownerPromotions.detail.unlimited')}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
