/**
 * @file _authed/social/footers/index.tsx
 * @description Admin social post footer catalog list page (SPEC-254 T-020).
 *
 * Filterable, paginated DataTable for social_post_footers with:
 * - Columns: name, content (truncated), platform, priority, default, active
 * - Filter bar: search, platform dropdown, active toggle
 * - Create/Edit via FooterFormModal (permission-gated: SOCIAL_FOOTER_MANAGE)
 * - Delete via CatalogDeleteConfirm (permission-gated: SOCIAL_FOOTER_MANAGE)
 * - Loading skeleton, empty state, error state
 *
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import type { CatalogListFilters } from '@/hooks/use-social-catalog';
import { useDeleteSocialFooter, useSocialFootersList } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialPostFooter } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CatalogDeleteConfirm } from '../catalog/-components/CatalogDeleteConfirm';
import { FooterFormModal } from './-components/FooterFormModal';
import { FootersTable } from './-components/FootersTable';

export const Route = createFileRoute('/_authed/social/footers/')({
    component: FootersPage,
    errorComponent: createErrorComponent('SocialFooters'),
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

/** Admin social post footer catalog list page. */
function FootersPage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<SocialPostFooter | null>(null);
    const [deleteItem, setDeleteItem] = useState<SocialPostFooter | null>(null);

    const queryFilters: CatalogListFilters = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        platform: filters.platform || undefined,
        active: filters.active === 'true' ? true : filters.active === 'false' ? false : undefined
    };

    const { data, isLoading, error } = useSocialFootersList(queryFilters);
    const deleteMutation = useDeleteSocialFooter();

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered = !!(filters.search || filters.platform || filters.active);

    const handleFiltersChange = (next: FilterState) => {
        setFilters(next);
        setPage(1);
    };

    const handleEdit = (item: SocialPostFooter) => {
        setEditItem(item);
        setFormOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setFormOpen(true);
    };

    const handleDeleteRequest = (item: SocialPostFooter) => setDeleteItem(item);

    const handleDeleteConfirm = () => {
        if (!deleteItem) return;
        deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null)
        });
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_FOOTER_MANAGE]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.footers.title' as TranslationKey)}
                    </h1>
                    <div className="flex items-center gap-3">
                        {pagination && (
                            <span className="text-muted-foreground text-sm">
                                {tPlural(
                                    'social.footers.results' as TranslationKey,
                                    pagination.total,
                                    {
                                        count: pagination.total
                                    }
                                )}
                            </span>
                        )}
                        <Button
                            onClick={handleCreate}
                            data-testid="footer-create-btn"
                        >
                            {t('social.footers.createBtn' as TranslationKey)}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                        <label
                            htmlFor="ft-search"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.footers.filters.search' as TranslationKey)}
                        </label>
                        <input
                            id="ft-search"
                            type="search"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            placeholder={t(
                                'social.footers.filters.searchPlaceholder' as TranslationKey
                            )}
                            value={filters.search}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, search: e.target.value })
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="ft-platform"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.footers.filters.platform' as TranslationKey)}
                        </label>
                        <select
                            id="ft-platform"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.platform}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, platform: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.footers.filters.all' as TranslationKey)}
                            </option>
                            <option value="INSTAGRAM">Instagram</option>
                            <option value="FACEBOOK">Facebook</option>
                            <option value="X">X (Twitter)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="ft-active"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.footers.filters.active' as TranslationKey)}
                        </label>
                        <select
                            id="ft-active"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.active}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, active: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.footers.filters.all' as TranslationKey)}
                            </option>
                            <option value="true">
                                {t('social.footers.filters.activeOnly' as TranslationKey)}
                            </option>
                            <option value="false">
                                {t('social.footers.filters.inactiveOnly' as TranslationKey)}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="footers-loading-skeleton"
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
                        data-testid="footers-error"
                    >
                        {t('social.footers.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="footers-empty-state"
                    >
                        <p>
                            {isFiltered
                                ? t('social.footers.list.emptyFiltered' as TranslationKey)
                                : t('social.footers.list.empty' as TranslationKey)}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                {t('social.footers.list.clearFilters' as TranslationKey)}
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <FootersTable
                        items={items}
                        onEdit={handleEdit}
                        onDelete={handleDeleteRequest}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.footers.list.pagination' as TranslationKey, {
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
                                {t('social.footers.list.prevPage' as TranslationKey)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.footers.list.nextPage' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <FooterFormModal
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
                i18nPrefix="social.footers"
            />
        </RoutePermissionGuard>
    );
}
