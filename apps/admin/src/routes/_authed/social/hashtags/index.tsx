/**
 * @file _authed/social/hashtags/index.tsx
 * @description Admin social hashtag catalog list page (SPEC-254 T-020).
 *
 * Filterable, paginated DataTable for social_hashtags with:
 * - Columns: hashtag, category, platform, priority, active
 * - Filter bar: search, platform dropdown, active toggle
 * - Create/Edit via HashtagFormModal (permission-gated: SOCIAL_HASHTAG_MANAGE)
 * - Delete via CatalogDeleteConfirm (permission-gated: SOCIAL_HASHTAG_MANAGE)
 * - Loading skeleton, empty state, error state
 * - Surfaces 409/ALREADY_EXISTS as a friendly conflict message in the form modal
 *
 * Permission guard: SOCIAL_HASHTAG_VIEW (read), SOCIAL_HASHTAG_MANAGE (write).
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import type { CatalogListFilters } from '@/hooks/use-social-catalog';
import { useDeleteSocialHashtag, useSocialHashtagsList } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialHashtag } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CatalogDeleteConfirm } from '../catalog/-components/CatalogDeleteConfirm';
import { HashtagFormModal } from './-components/HashtagFormModal';
import { HashtagsTable } from './-components/HashtagsTable';

export const Route = createFileRoute('/_authed/social/hashtags/')({
    component: HashtagsPage,
    errorComponent: createErrorComponent('SocialHashtags'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 20;
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

interface FilterState {
    search: string;
    platform: string;
    active: string;
}

const EMPTY_FILTERS: FilterState = { search: '', platform: '', active: '' };

/** Admin social hashtag catalog list page. */
function HashtagsPage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    // Modal state
    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<SocialHashtag | null>(null);
    const [deleteItem, setDeleteItem] = useState<SocialHashtag | null>(null);

    const queryFilters: CatalogListFilters = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        platform: filters.platform || undefined,
        active: filters.active === 'true' ? true : filters.active === 'false' ? false : undefined
    };

    const { data, isLoading, error } = useSocialHashtagsList(queryFilters);
    const deleteMutation = useDeleteSocialHashtag();

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered = !!(filters.search || filters.platform || filters.active);

    const handleFiltersChange = (next: FilterState) => {
        setFilters(next);
        setPage(1);
    };

    const handleEdit = (item: SocialHashtag) => {
        setEditItem(item);
        setFormOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setFormOpen(true);
    };

    const handleDeleteRequest = (item: SocialHashtag) => {
        setDeleteItem(item);
    };

    const handleDeleteConfirm = () => {
        if (!deleteItem) return;
        deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null)
        });
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_HASHTAG_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.hashtags.title' as TranslationKey)}
                    </h1>
                    <div className="flex items-center gap-3">
                        {pagination && (
                            <span className="text-muted-foreground text-sm">
                                {tPlural(
                                    'social.hashtags.results' as TranslationKey,
                                    pagination.total,
                                    {
                                        count: pagination.total
                                    }
                                )}
                            </span>
                        )}
                        <Button
                            onClick={handleCreate}
                            data-testid="hashtag-create-btn"
                        >
                            {t('social.hashtags.createBtn' as TranslationKey)}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                        <label
                            htmlFor="ht-search"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.hashtags.filters.search' as TranslationKey)}
                        </label>
                        <input
                            id="ht-search"
                            type="search"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            placeholder={t(
                                'social.hashtags.filters.searchPlaceholder' as TranslationKey
                            )}
                            value={filters.search}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, search: e.target.value })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="ht-platform"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.hashtags.filters.platform' as TranslationKey)}
                        </label>
                        <select
                            id="ht-platform"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.platform}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, platform: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.hashtags.filters.all' as TranslationKey)}
                            </option>
                            <option value="INSTAGRAM">Instagram</option>
                            <option value="FACEBOOK">Facebook</option>
                            <option value="X">X (Twitter)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="ht-active"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.hashtags.filters.active' as TranslationKey)}
                        </label>
                        <select
                            id="ht-active"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.active}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, active: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.hashtags.filters.all' as TranslationKey)}
                            </option>
                            <option value="true">
                                {t('social.hashtags.filters.activeOnly' as TranslationKey)}
                            </option>
                            <option value="false">
                                {t('social.hashtags.filters.inactiveOnly' as TranslationKey)}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Loading skeleton */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="hashtags-loading-skeleton"
                    >
                        {SKELETON_KEYS.map((key) => (
                            <div
                                key={key}
                                className="h-12 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                        data-testid="hashtags-error"
                    >
                        {t('social.hashtags.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="hashtags-empty-state"
                    >
                        <p>
                            {isFiltered
                                ? t('social.hashtags.list.emptyFiltered' as TranslationKey)
                                : t('social.hashtags.list.empty' as TranslationKey)}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                {t('social.hashtags.list.clearFilters' as TranslationKey)}
                            </Button>
                        )}
                    </div>
                )}

                {/* Data table */}
                {!isLoading && !error && items.length > 0 && (
                    <HashtagsTable
                        items={items}
                        onEdit={handleEdit}
                        onDelete={handleDeleteRequest}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.hashtags.list.pagination' as TranslationKey, {
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
                                {t('social.hashtags.list.prevPage' as TranslationKey)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.hashtags.list.nextPage' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit modal */}
            <HashtagFormModal
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) setEditItem(null);
                }}
                item={editItem}
            />

            {/* Delete confirm dialog */}
            <CatalogDeleteConfirm
                open={deleteItem !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
                itemName={deleteItem?.normalizedHashtag ?? ''}
                isDeleting={deleteMutation.isPending}
                onConfirm={handleDeleteConfirm}
                i18nPrefix="social.hashtags"
            />
        </RoutePermissionGuard>
    );
}
