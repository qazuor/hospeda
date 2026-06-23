/**
 * @file _authed/social/batches/index.tsx
 * @description Admin social content batch catalog list page (SPEC-254 T-020).
 *
 * Filterable, paginated DataTable for social_content_batches with:
 * - Columns: name, description, starts, ends, active
 * - Filter bar: search, active toggle
 * - Create/Edit via BatchFormModal (permission-gated: SOCIAL_BATCH_MANAGE)
 * - Delete via CatalogDeleteConfirm (permission-gated: SOCIAL_BATCH_MANAGE)
 * - Loading skeleton, empty state, error state
 *
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import type { CatalogListFilters } from '@/hooks/use-social-catalog';
import { useDeleteSocialBatch, useSocialBatchesList } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialContentBatch } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CatalogDeleteConfirm } from '../catalog/-components/CatalogDeleteConfirm';
import { BatchFormModal } from './-components/BatchFormModal';
import { BatchesTable } from './-components/BatchesTable';

export const Route = createFileRoute('/_authed/social/batches/')({
    component: BatchesPage,
    errorComponent: createErrorComponent('SocialBatches'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 20;
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

interface FilterState {
    search: string;
    active: string;
}

const EMPTY_FILTERS: FilterState = { search: '', active: '' };

/** Admin social content batch catalog list page. */
function BatchesPage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<SocialContentBatch | null>(null);
    const [deleteItem, setDeleteItem] = useState<SocialContentBatch | null>(null);

    const queryFilters: CatalogListFilters = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        active: filters.active === 'true' ? true : filters.active === 'false' ? false : undefined
    };

    const { data, isLoading, error } = useSocialBatchesList(queryFilters);
    const deleteMutation = useDeleteSocialBatch();

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered = !!(filters.search || filters.active);

    const handleFiltersChange = (next: FilterState) => {
        setFilters(next);
        setPage(1);
    };

    const handleEdit = (item: SocialContentBatch) => {
        setEditItem(item);
        setFormOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setFormOpen(true);
    };

    const handleDeleteRequest = (item: SocialContentBatch) => setDeleteItem(item);

    const handleDeleteConfirm = () => {
        if (!deleteItem) return;
        deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null)
        });
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_BATCH_MANAGE]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.batches.title' as TranslationKey)}
                    </h1>
                    <div className="flex items-center gap-3">
                        {pagination && (
                            <span className="text-muted-foreground text-sm">
                                {tPlural(
                                    'social.batches.results' as TranslationKey,
                                    pagination.total,
                                    { count: pagination.total }
                                )}
                            </span>
                        )}
                        <Button
                            onClick={handleCreate}
                            data-testid="batch-create-btn"
                        >
                            {t('social.batches.createBtn' as TranslationKey)}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                        <label
                            htmlFor="bt-search"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.batches.filters.search' as TranslationKey)}
                        </label>
                        <input
                            id="bt-search"
                            type="search"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            placeholder={t(
                                'social.batches.filters.searchPlaceholder' as TranslationKey
                            )}
                            value={filters.search}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, search: e.target.value })
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="bt-active"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.batches.filters.active' as TranslationKey)}
                        </label>
                        <select
                            id="bt-active"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.active}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, active: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.batches.filters.all' as TranslationKey)}
                            </option>
                            <option value="true">
                                {t('social.batches.filters.activeOnly' as TranslationKey)}
                            </option>
                            <option value="false">
                                {t('social.batches.filters.inactiveOnly' as TranslationKey)}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="batches-loading-skeleton"
                    >
                        {SKELETON_KEYS.map((key) => (
                            <div
                                key={key}
                                className="h-12 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="batches-error"
                    >
                        {t('social.batches.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="batches-empty-state"
                    >
                        <p>
                            {isFiltered
                                ? t('social.batches.list.emptyFiltered' as TranslationKey)
                                : t('social.batches.list.empty' as TranslationKey)}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                {t('social.batches.list.clearFilters' as TranslationKey)}
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <BatchesTable
                        items={items}
                        onEdit={handleEdit}
                        onDelete={handleDeleteRequest}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.batches.list.pagination' as TranslationKey, {
                                page: pagination.page,
                                totalPages: pagination.totalPages,
                                total: pagination.total
                            })}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                {t('social.batches.list.prevPage' as TranslationKey)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.batches.list.nextPage' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <BatchFormModal
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) setEditItem(null);
                }}
                item={editItem}
            />

            <CatalogDeleteConfirm
                open={deleteItem !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
                itemName={deleteItem?.name ?? ''}
                isDeleting={deleteMutation.isPending}
                onConfirm={handleDeleteConfirm}
                i18nPrefix="social.batches"
            />
        </RoutePermissionGuard>
    );
}
