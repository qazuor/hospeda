/**
 * @file _authed/social/platform-formats/index.tsx
 * @description Admin social platform format config list page (SPEC-254 T-021).
 *
 * Read-only list of all platform × publish-format configuration rows with:
 * - Columns: platform, publishFormat, mediaType, enabled, mvpEnabled,
 *   maxCaptionLength, makeChannelKey
 * - Edit action only (SOCIAL_PLATFORM_MANAGE) — NO create, NO delete (seed-only rows)
 * - Edit modal shows an amber warning when operator would disable a currently-enabled
 *   format (possible active targets still referencing it)
 * - Loading skeleton, empty state, error state
 *
 * Permission guard: SOCIAL_PLATFORM_FORMAT_VIEW (read), SOCIAL_PLATFORM_MANAGE (edit).
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { PlatformSettingsListFilters } from '@/hooks/use-social-platform-settings';
import { usePlatformFormatsList } from '@/hooks/use-social-platform-settings';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialPlatformFormat } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PlatformFormatFormModal } from './-components/PlatformFormatFormModal';
import { PlatformFormatsTable } from './-components/PlatformFormatsTable';

export const Route = createFileRoute('/_authed/social/platform-formats/')({
    component: PlatformFormatsPage,
    errorComponent: createErrorComponent('SocialPlatformFormats'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 20;
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

/** Admin social platform formats config list page. */
function PlatformFormatsPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);

    const [editItem, setEditItem] = useState<SocialPlatformFormat | null>(null);

    const queryFilters: PlatformSettingsListFilters = {
        page,
        pageSize: PAGE_SIZE
    };

    const { data, isLoading, error } = usePlatformFormatsList(queryFilters);

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    const handleEdit = (item: SocialPlatformFormat) => {
        setEditItem(item);
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.platformFormats.title' as TranslationKey)}
                    </h1>
                    {pagination && (
                        <span className="text-muted-foreground text-sm">
                            {t('social.platformFormats.total' as TranslationKey, {
                                count: pagination.total
                            })}
                        </span>
                    )}
                </div>

                {/* Loading skeleton */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="platform-formats-loading-skeleton"
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
                        data-testid="platform-formats-error"
                    >
                        {t('social.platformFormats.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="platform-formats-empty-state"
                    >
                        <p>{t('social.platformFormats.list.empty' as TranslationKey)}</p>
                    </div>
                )}

                {/* Data table */}
                {!isLoading && !error && items.length > 0 && (
                    <PlatformFormatsTable
                        items={items}
                        onEdit={handleEdit}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.platformFormats.list.pagination' as TranslationKey, {
                                page: pagination.page,
                                totalPages: pagination.totalPages,
                                total: pagination.total
                            })}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                {t('social.platformFormats.list.prevPage' as TranslationKey)}
                            </button>
                            <button
                                type="button"
                                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.platformFormats.list.nextPage' as TranslationKey)}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            <PlatformFormatFormModal
                open={editItem !== null}
                onOpenChange={(open) => {
                    if (!open) setEditItem(null);
                }}
                item={editItem}
            />
        </RoutePermissionGuard>
    );
}
