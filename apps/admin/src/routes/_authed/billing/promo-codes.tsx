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
import { Input } from '@/components/ui/input';
import {
    type CreatePromoCodePayload,
    type DiscountType,
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
import { PromoCodeDeleteDialog } from './components/PromoCodeDeleteDialog';
import { PromoCodeFormDialog } from './components/PromoCodeFormDialog';

export const Route = createFileRoute('/_authed/billing/promo-codes')({
    component: BillingPromoCodesPage
});

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
        isDeleting: deleteMutation.isPending,
        t: t as (key: string) => string
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
                                <p className="mt-2 text-destructive text-sm">{error.message}</p>
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
                    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
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

            <PromoCodeDeleteDialog
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
