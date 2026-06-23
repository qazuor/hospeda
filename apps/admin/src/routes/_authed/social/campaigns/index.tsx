/**
 * @file _authed/social/campaigns/index.tsx
 * @description Admin social campaign catalog list page (SPEC-254 T-020).
 *
 * Filterable, paginated DataTable for social_campaigns with:
 * - Columns: name, description, starts, ends, active
 * - Filter bar: search, active toggle
 * - Create/Edit via CampaignFormModal (permission-gated: SOCIAL_CAMPAIGN_MANAGE)
 * - Delete via CatalogDeleteConfirm (permission-gated: SOCIAL_CAMPAIGN_MANAGE)
 * - Loading skeleton, empty state, error state
 *
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import type { CatalogListFilters } from '@/hooks/use-social-catalog';
import { useDeleteSocialCampaign, useSocialCampaignsList } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialCampaign } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CatalogDeleteConfirm } from '../catalog/-components/CatalogDeleteConfirm';
import { CampaignFormModal } from './-components/CampaignFormModal';
import { CampaignsTable } from './-components/CampaignsTable';

export const Route = createFileRoute('/_authed/social/campaigns/')({
    component: CampaignsPage,
    errorComponent: createErrorComponent('SocialCampaigns'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 20;
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

interface FilterState {
    search: string;
    active: string;
}

const EMPTY_FILTERS: FilterState = { search: '', active: '' };

/** Admin social campaign catalog list page. */
function CampaignsPage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<SocialCampaign | null>(null);
    const [deleteItem, setDeleteItem] = useState<SocialCampaign | null>(null);

    const queryFilters: CatalogListFilters = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        active: filters.active === 'true' ? true : filters.active === 'false' ? false : undefined
    };

    const { data, isLoading, error } = useSocialCampaignsList(queryFilters);
    const deleteMutation = useDeleteSocialCampaign();

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered = !!(filters.search || filters.active);

    const handleFiltersChange = (next: FilterState) => {
        setFilters(next);
        setPage(1);
    };

    const handleEdit = (item: SocialCampaign) => {
        setEditItem(item);
        setFormOpen(true);
    };

    const handleCreate = () => {
        setEditItem(null);
        setFormOpen(true);
    };

    const handleDeleteRequest = (item: SocialCampaign) => setDeleteItem(item);

    const handleDeleteConfirm = () => {
        if (!deleteItem) return;
        deleteMutation.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null)
        });
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_CAMPAIGN_MANAGE]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.campaigns.title' as TranslationKey)}
                    </h1>
                    <div className="flex items-center gap-3">
                        {pagination && (
                            <span className="text-muted-foreground text-sm">
                                {tPlural(
                                    'social.campaigns.results' as TranslationKey,
                                    pagination.total,
                                    { count: pagination.total }
                                )}
                            </span>
                        )}
                        <Button
                            onClick={handleCreate}
                            data-testid="campaign-create-btn"
                        >
                            {t('social.campaigns.createBtn' as TranslationKey)}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                        <label
                            htmlFor="cm-search"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.campaigns.filters.search' as TranslationKey)}
                        </label>
                        <input
                            id="cm-search"
                            type="search"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            placeholder={t(
                                'social.campaigns.filters.searchPlaceholder' as TranslationKey
                            )}
                            value={filters.search}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, search: e.target.value })
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="cm-active"
                            className="text-muted-foreground text-xs"
                        >
                            {t('social.campaigns.filters.active' as TranslationKey)}
                        </label>
                        <select
                            id="cm-active"
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                            value={filters.active}
                            onChange={(e) =>
                                handleFiltersChange({ ...filters, active: e.target.value })
                            }
                        >
                            <option value="">
                                {t('social.campaigns.filters.all' as TranslationKey)}
                            </option>
                            <option value="true">
                                {t('social.campaigns.filters.activeOnly' as TranslationKey)}
                            </option>
                            <option value="false">
                                {t('social.campaigns.filters.inactiveOnly' as TranslationKey)}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="campaigns-loading-skeleton"
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
                        data-testid="campaigns-error"
                    >
                        {t('social.campaigns.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="campaigns-empty-state"
                    >
                        <p>
                            {isFiltered
                                ? t('social.campaigns.list.emptyFiltered' as TranslationKey)
                                : t('social.campaigns.list.empty' as TranslationKey)}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                {t('social.campaigns.list.clearFilters' as TranslationKey)}
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <CampaignsTable
                        items={items}
                        onEdit={handleEdit}
                        onDelete={handleDeleteRequest}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.campaigns.list.pagination' as TranslationKey, {
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
                                {t('social.campaigns.list.prevPage' as TranslationKey)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.campaigns.list.nextPage' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <CampaignFormModal
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
                i18nPrefix="social.campaigns"
            />
        </RoutePermissionGuard>
    );
}
