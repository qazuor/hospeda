/**
 * Promo Codes Management Page
 *
 * Manages promotional discount codes for subscription plans.
 * Supports creating, editing, activating/deactivating, and deleting promo codes.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    type CreatePromoCodePayload,
    type DiscountType,
    type PlanCategory,
    type PromoCode,
    type PromoCodeStatus,
    getPromoCodeColumns,
    useCreatePromoCodeMutation,
    useDeletePromoCodeMutation,
    usePromoCodesQuery,
    useTogglePromoCodeActiveMutation,
    useUpdatePromoCodeMutation
} from '@/features/promo-codes';
import { useTranslations } from '@/hooks/use-translations';
import { AddIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/promo-codes')({
    component: BillingPromoCodesPage
});

/**
 * Create/Edit Dialog Component
 */
function PromoCodeFormDialog({
    promoCode,
    isOpen,
    onClose,
    onSubmit
}: {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (data: CreatePromoCodePayload) => void;
}) {
    const { t } = useTranslations();
    const isEdit = !!promoCode;

    const [formData, setFormData] = useState<CreatePromoCodePayload>({
        code: promoCode?.code || '',
        description: promoCode?.description || '',
        type: promoCode?.type || 'percentage',
        discountValue: promoCode?.discountValue || 0,
        maxUses: promoCode?.maxUses || null,
        maxUsesPerUser: promoCode?.maxUsesPerUser || null,
        validFrom: promoCode?.validFrom || new Date(),
        validUntil: promoCode?.validUntil || null,
        applicablePlans: promoCode?.applicablePlans
            ? [...promoCode.applicablePlans]
            : ['owner', 'complex', 'tourist'],
        isStackable: promoCode?.isStackable || false,
        isActive: promoCode?.isActive ?? true,
        requiresFirstPurchase: promoCode?.requiresFirstPurchase || false,
        minimumAmount: promoCode?.minimumAmount || null
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Convert code to uppercase
        const payload = {
            ...formData,
            code: formData.code.toUpperCase()
        };

        onSubmit(payload);
    };

    const handlePlanToggle = (plan: PlanCategory) => {
        const currentPlans = formData.applicablePlans;
        const newPlans = currentPlans.includes(plan)
            ? currentPlans.filter((p) => p !== plan)
            : [...currentPlans, plan];

        setFormData({ ...formData, applicablePlans: newPlans });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit
                            ? t('admin-billing.promoCodes.form.editTitle')
                            : t('admin-billing.promoCodes.form.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('admin-billing.promoCodes.form.editDescription')
                            : t('admin-billing.promoCodes.form.createDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Code */}
                    <div className="space-y-2">
                        <Label htmlFor="code">{t('admin-billing.promoCodes.form.codeLabel')}</Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                                setFormData({ ...formData, code: e.target.value.toUpperCase() })
                            }
                            placeholder={t('admin-billing.promoCodes.form.codePlaceholder')}
                            className="font-mono uppercase"
                            required
                            disabled={isEdit}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            {t('admin-billing.promoCodes.form.descriptionLabel')}
                        </Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder={t('admin-billing.promoCodes.form.descriptionPlaceholder')}
                            required
                        />
                    </div>

                    {/* Type and Value */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">
                                {t('admin-billing.promoCodes.form.discountTypeLabel')}
                            </Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, type: value as DiscountType })
                                }
                            >
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">
                                        {t('admin-billing.promoCodes.form.typePercentage')}
                                    </SelectItem>
                                    <SelectItem value="fixed">
                                        {t('admin-billing.promoCodes.form.typeFixed')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="discountValue">
                                {t('admin-billing.promoCodes.form.valueLabel')}{' '}
                                {formData.type === 'percentage'
                                    ? t('admin-billing.promoCodes.form.valuePercentageSuffix')
                                    : t('admin-billing.promoCodes.form.valueFixedSuffix')}
                            </Label>
                            <Input
                                id="discountValue"
                                type="number"
                                value={formData.discountValue}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        discountValue: Number(e.target.value)
                                    })
                                }
                                min={0}
                                max={formData.type === 'percentage' ? 100 : undefined}
                                required
                            />
                        </div>
                    </div>

                    {/* Usage limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxUses">
                                {t('admin-billing.promoCodes.form.maxUsesLabel')}
                            </Label>
                            <Input
                                id="maxUses"
                                type="number"
                                value={formData.maxUses || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUses: e.target.value ? Number(e.target.value) : null
                                    })
                                }
                                placeholder={t(
                                    'admin-billing.promoCodes.form.unlimitedPlaceholder'
                                )}
                                min={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxUsesPerUser">
                                {t('admin-billing.promoCodes.form.maxUsesPerUserLabel')}
                            </Label>
                            <Input
                                id="maxUsesPerUser"
                                type="number"
                                value={formData.maxUsesPerUser || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUsesPerUser: e.target.value
                                            ? Number(e.target.value)
                                            : null
                                    })
                                }
                                placeholder={t(
                                    'admin-billing.promoCodes.form.unlimitedPlaceholder'
                                )}
                                min={1}
                            />
                        </div>
                    </div>

                    {/* Validity dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="validFrom">
                                {t('admin-billing.promoCodes.form.validFromLabel')}
                            </Label>
                            <Input
                                id="validFrom"
                                type="date"
                                value={
                                    formData.validFrom instanceof Date
                                        ? formData.validFrom.toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        validFrom: new Date(e.target.value)
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validUntil">
                                {t('admin-billing.promoCodes.form.validUntilLabel')}
                            </Label>
                            <Input
                                id="validUntil"
                                type="date"
                                value={
                                    formData.validUntil instanceof Date
                                        ? formData.validUntil.toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        validUntil: e.target.value ? new Date(e.target.value) : null
                                    })
                                }
                                placeholder={t('admin-billing.promoCodes.form.noDateLimit')}
                            />
                        </div>
                    </div>

                    {/* Minimum amount */}
                    <div className="space-y-2">
                        <Label htmlFor="minimumAmount">
                            {t('admin-billing.promoCodes.form.minimumAmountLabel')}
                        </Label>
                        <Input
                            id="minimumAmount"
                            type="number"
                            value={formData.minimumAmount || ''}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    minimumAmount: e.target.value ? Number(e.target.value) : null
                                })
                            }
                            placeholder={t('admin-billing.promoCodes.form.noMinimum')}
                            min={0}
                        />
                    </div>

                    {/* Applicable plans */}
                    <div className="space-y-2">
                        <Label>{t('admin-billing.promoCodes.form.applicablePlansLabel')}</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('owner')}
                                    onChange={() => handlePlanToggle('owner')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">
                                    {t('admin-billing.promoCodes.form.planOwner')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('complex')}
                                    onChange={() => handlePlanToggle('complex')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">
                                    {t('admin-billing.promoCodes.form.planComplex')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('tourist')}
                                    onChange={() => handlePlanToggle('tourist')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">
                                    {t('admin-billing.promoCodes.form.planTourist')}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Switches */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="isActive">
                                {t('admin-billing.promoCodes.form.isActiveLabel')}
                            </Label>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isActive: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="isStackable">
                                {t('admin-billing.promoCodes.form.isStackableLabel')}
                            </Label>
                            <Switch
                                id="isStackable"
                                checked={formData.isStackable}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isStackable: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="requiresFirstPurchase">
                                {t('admin-billing.promoCodes.form.requiresFirstPurchaseLabel')}
                            </Label>
                            <Switch
                                id="requiresFirstPurchase"
                                checked={formData.requiresFirstPurchase}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, requiresFirstPurchase: checked })
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {t('admin-billing.promoCodes.form.cancelButton')}
                        </Button>
                        <Button type="submit">
                            {isEdit
                                ? t('admin-billing.promoCodes.form.editSubmit')
                                : t('admin-billing.promoCodes.form.createSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Delete Confirmation Dialog
 */
function DeleteConfirmDialog({
    promoCode,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
}) {
    const { t } = useTranslations();
    if (!promoCode) return null;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.promoCodes.deleteDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.promoCodes.deleteDialog.description')}{' '}
                        <code className="font-bold font-mono">{promoCode.code}</code>?
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-destructive text-sm">
                        ⚠️ {t('admin-billing.promoCodes.deleteDialog.warning')}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.promoCodes.deleteDialog.cancelButton')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        {t('admin-billing.promoCodes.deleteDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Main Page Component
 */
function BillingPromoCodesPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<PromoCodeStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<DiscountType | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedPromoCode, setSelectedPromoCode] = useState<PromoCode | null>(null);

    // Fetch promo codes
    const { data, isLoading, error } = usePromoCodesQuery({
        page,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: searchQuery || undefined
    });

    const createMutation = useCreatePromoCodeMutation();
    const updateMutation = useUpdatePromoCodeMutation();
    const toggleActiveMutation = useTogglePromoCodeActiveMutation();
    const deleteMutation = useDeletePromoCodeMutation();

    const promoCodes = (data?.items as PromoCode[] | undefined) ?? [];
    const total = (data?.pagination?.total as number | undefined) ?? 0;

    const handleCreateNew = () => {
        setSelectedPromoCode(null);
        setFormDialogOpen(true);
    };

    const handleEdit = (promoCode: PromoCode) => {
        setSelectedPromoCode(promoCode);
        setFormDialogOpen(true);
    };

    const handleFormSubmit = (formData: CreatePromoCodePayload) => {
        if (selectedPromoCode) {
            // Update
            updateMutation.mutate(
                { id: selectedPromoCode.id, ...formData },
                {
                    onSuccess: () => {
                        addToast({
                            message: t('admin-billing.promoCodes.toasts.updated'),
                            variant: 'success'
                        });
                        setFormDialogOpen(false);
                        setSelectedPromoCode(null);
                    },
                    onError: (error) => {
                        addToast({
                            message:
                                error.message || t('admin-billing.promoCodes.toasts.updateError'),
                            variant: 'error'
                        });
                    }
                }
            );
        } else {
            // Create
            createMutation.mutate(formData, {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.promoCodes.toasts.created'),
                        variant: 'success'
                    });
                    setFormDialogOpen(false);
                },
                onError: (error) => {
                    addToast({
                        message: error.message || t('admin-billing.promoCodes.toasts.createError'),
                        variant: 'error'
                    });
                }
            });
        }
    };

    const handleToggleActive = (id: string, isActive: boolean) => {
        if (!data?.items) {
            addToast({
                message: t('admin-billing.promoCodes.toasts.apiRequired'),
                variant: 'error'
            });
            return;
        }

        toggleActiveMutation.mutate(
            { id, isActive },
            {
                onSuccess: () => {
                    addToast({
                        message: isActive
                            ? t('admin-billing.promoCodes.toasts.activated')
                            : t('admin-billing.promoCodes.toasts.deactivated'),
                        variant: 'success'
                    });
                },
                onError: (error) => {
                    addToast({
                        message: error.message || t('admin-billing.promoCodes.toasts.toggleError'),
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleDeleteClick = (promoCode: PromoCode) => {
        setSelectedPromoCode(promoCode);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!selectedPromoCode) return;

        deleteMutation.mutate(selectedPromoCode.id, {
            onSuccess: () => {
                addToast({
                    message: t('admin-billing.promoCodes.toasts.deleted'),
                    variant: 'success'
                });
                setDeleteDialogOpen(false);
                setSelectedPromoCode(null);
            },
            onError: (error) => {
                addToast({
                    message: error.message || t('admin-billing.promoCodes.toasts.deleteError'),
                    variant: 'error'
                });
            }
        });
    };

    const columns = getPromoCodeColumns({
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
        onDelete: handleDeleteClick,
        isTogglingActive: toggleActiveMutation.isPending,
        isDeleting: deleteMutation.isPending
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.promoCodes.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('admin-billing.promoCodes.description')}
                        </p>
                    </div>

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="text-muted-foreground">
                                    {t('admin-billing.promoCodes.apiLoadError')}
                                </p>
                                <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.promoCodes.staticFallback')}
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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">
                            {t('admin-billing.promoCodes.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('admin-billing.promoCodes.description')}
                        </p>
                    </div>
                </div>

                {/* API Warning */}
                {!data?.items && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800">
                                <strong>{t('admin-billing.promoCodes.noteLabel')}</strong>{' '}
                                {t('admin-billing.promoCodes.apiUnavailable')}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Filters and Actions */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4">
                        <Input
                            type="search"
                            placeholder={t('admin-billing.promoCodes.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value as PromoCodeStatus | 'all')
                            }
                        >
                            <option value="all">
                                {t('admin-billing.promoCodes.filters.allStatuses')}
                            </option>
                            <option value="active">
                                {t('admin-billing.promoCodes.filters.active')}
                            </option>
                            <option value="expired">
                                {t('admin-billing.promoCodes.filters.expired')}
                            </option>
                            <option value="inactive">
                                {t('admin-billing.promoCodes.filters.inactive')}
                            </option>
                        </select>

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as DiscountType | 'all')}
                        >
                            <option value="all">
                                {t('admin-billing.promoCodes.filters.allTypes')}
                            </option>
                            <option value="percentage">
                                {t('admin-billing.promoCodes.filters.percentage')}
                            </option>
                            <option value="fixed">
                                {t('admin-billing.promoCodes.filters.fixed')}
                            </option>
                        </select>
                    </div>

                    <Button onClick={handleCreateNew}>
                        <AddIcon className="mr-2 h-4 w-4" />
                        {t('admin-billing.promoCodes.createButton')}
                    </Button>
                </div>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t('admin-billing.promoCodes.tableTitle')} ({total})
                            {searchQuery && (
                                <Badge
                                    variant="secondary"
                                    className="ml-2"
                                >
                                    {t('admin-billing.promoCodes.filteredLabel')}{' '}
                                    {promoCodes.length}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {t('admin-billing.promoCodes.tableDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={promoCodes}
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
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs */}
            <PromoCodeFormDialog
                promoCode={selectedPromoCode}
                isOpen={formDialogOpen}
                onClose={() => {
                    setFormDialogOpen(false);
                    setSelectedPromoCode(null);
                }}
                onSubmit={handleFormSubmit}
            />

            <DeleteConfirmDialog
                promoCode={selectedPromoCode}
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setSelectedPromoCode(null);
                }}
                onConfirm={handleDeleteConfirm}
            />
        </SidebarPageLayout>
    );
}
