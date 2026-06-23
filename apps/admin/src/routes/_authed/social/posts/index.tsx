/**
 * @file _authed/social/posts/index.tsx
 * @description Admin social posts list page (SPEC-254 T-039).
 *
 * Filterable, paginated list of social posts with:
 * - color-coded pipeline status + approval status badges
 * - platform icon row with aria-label
 * - optimistic approve action (permission-gated)
 * - loading skeleton, empty state, and error state
 *
 * Permission guard: SOCIAL_POST_VIEW (enforced server-side and via RoutePermissionGuard).
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { useSocialPostsList } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SocialPostFilters, type SocialPostFiltersValue } from './-components/SocialPostFilters';
import { SocialPostsTable } from './-components/SocialPostsTable';

export const Route = createFileRoute('/_authed/social/posts/')({
    component: SocialPostsPage,
    errorComponent: createErrorComponent('SocialPosts'),
    pendingComponent: createPendingComponent()
});

const EMPTY_FILTERS: SocialPostFiltersValue = {
    search: '',
    status: '',
    approvalStatus: '',
    platform: ''
};

const PAGE_SIZE = 20;

/** Stable keys for the loading skeleton rows (avoids array-index keys). */
const SKELETON_ROW_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

/** Admin social posts list page. */
function SocialPostsPage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<SocialPostFiltersValue>(EMPTY_FILTERS);

    const { data, isLoading, error } = useSocialPostsList({
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        status: filters.status || undefined,
        approvalStatus: filters.approvalStatus || undefined,
        platform: filters.platform || undefined
    });

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered =
        !!filters.search || !!filters.status || !!filters.approvalStatus || !!filters.platform;

    const handleFiltersChange = (next: SocialPostFiltersValue) => {
        setFilters(next);
        setPage(1);
    };

    const handleClearFilters = () => {
        setFilters(EMPTY_FILTERS);
        setPage(1);
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_POST_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">{t('social.posts.title')}</h1>
                    {pagination && (
                        <span className="text-muted-foreground text-sm">
                            {tPlural('social.posts.list.results', pagination.total, {
                                count: pagination.total
                            })}
                        </span>
                    )}
                </div>

                {/* Filter bar */}
                <SocialPostFilters
                    value={filters}
                    onChange={handleFiltersChange}
                />

                {/* Loading skeleton */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="posts-loading-skeleton"
                    >
                        {SKELETON_ROW_KEYS.map((rowKey) => (
                            <div
                                key={rowKey}
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
                        data-testid="posts-error"
                    >
                        {t('social.posts.list.error')}
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="posts-empty-state"
                    >
                        <p>
                            {isFiltered
                                ? t('social.posts.list.emptyFiltered')
                                : t('social.posts.list.empty')}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={handleClearFilters}
                            >
                                {t('social.posts.list.clearFilters')}
                            </Button>
                        )}
                    </div>
                )}

                {/* Posts table */}
                {!isLoading && !error && items.length > 0 && <SocialPostsTable items={items} />}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.posts.list.pagination', {
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
                                {t('social.posts.list.prevPage')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.posts.list.nextPage')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </RoutePermissionGuard>
    );
}
