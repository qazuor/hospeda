/**
 * @file _authed/comments/index.tsx
 * @description Admin comment moderation queue page (SPEC-165 T-017, AC-33/34).
 *
 * Shows a filterable, paginated list of all comments with inline
 * Approve / Reject / Delete actions. Badge state updates without a full page
 * reload (mutation invalidates the TanStack Query list cache — AC-34).
 *
 * Permission guard: POST_COMMENT_VIEW OR EVENT_COMMENT_VIEW (OR semantics via
 * RoutePermissionGuard; requireAll defaults false).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { useCommentsList } from '@/hooks/use-comment-moderation';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CommentsFilters, type CommentsFiltersValue } from './-components/CommentsFilters';
import { CommentsTable } from './-components/CommentsTable';

export const Route = createFileRoute('/_authed/comments/')({
    component: CommentsQueuePage,
    errorComponent: createErrorComponent('CommentsQueue'),
    pendingComponent: createPendingComponent()
});

const EMPTY_FILTERS: CommentsFiltersValue = {
    entityType: '',
    moderationState: '',
    search: '',
    includeDeleted: false
};

/** Comment moderation queue page. */
function CommentsQueuePage() {
    const { t, tPlural } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<CommentsFiltersValue>(EMPTY_FILTERS);

    const { data, isLoading, error } = useCommentsList({
        page,
        pageSize: 25,
        entityType: filters.entityType || undefined,
        moderationState: filters.moderationState || undefined,
        search: filters.search || undefined,
        includeDeleted: filters.includeDeleted || undefined
    });

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered =
        !!filters.entityType ||
        !!filters.moderationState ||
        !!filters.search ||
        filters.includeDeleted;

    return (
        <RoutePermissionGuard
            permissions={[PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW]}
        >
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">{t('comments.thread.header')}</h1>
                    {pagination && (
                        <span className="text-muted-foreground text-sm">
                            {tPlural('comments.list.results', pagination.total, {
                                count: pagination.total
                            })}
                        </span>
                    )}
                </div>

                {/* Filters */}
                <CommentsFilters
                    value={filters}
                    onChange={(next) => {
                        setFilters(next);
                        setPage(1);
                    }}
                />

                {/* Loading */}
                {isLoading && (
                    <p className="text-muted-foreground text-sm">
                        {t('comments.list.loading' as TranslationKey)}
                    </p>
                )}

                {/* Error */}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {t('comments.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                        <p>
                            {isFiltered
                                ? t('comments.list.emptyFiltered' as TranslationKey)
                                : t('comments.list.empty' as TranslationKey)}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                {t('comments.list.clearFilters' as TranslationKey)}
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && <CommentsTable items={items} />}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('comments.list.pagination' as TranslationKey, {
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
                                {t('comments.list.prevPage' as TranslationKey)}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('comments.list.nextPage' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </RoutePermissionGuard>
    );
}
