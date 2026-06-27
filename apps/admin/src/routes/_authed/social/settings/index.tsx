/**
 * @file _authed/social/settings/index.tsx
 * @description Admin social automation settings list page (SPEC-254 T-021).
 *
 * Key-value table for all social pipeline settings with:
 * - Columns: key, type (badge), value (masked for secrets), description
 * - Edit action only (SOCIAL_SETTINGS_MANAGE) — NO create, NO delete
 * - Edit modal allows updating the value field only
 * - Loading skeleton, empty state, error state
 *
 * Permission guard: SOCIAL_SETTINGS_MANAGE (read + write bundled per API design).
 * Pagination: page + pageSize (admin convention — NOT limit).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { PlatformSettingsListFilters } from '@/hooks/use-social-platform-settings';
import { useSocialSettingsList } from '@/hooks/use-social-platform-settings';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum, type SocialSetting } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SettingEditModal } from './-components/SettingEditModal';
import { SettingsTable } from './-components/SettingsTable';

export const Route = createFileRoute('/_authed/social/settings/')({
    component: SettingsPage,
    errorComponent: createErrorComponent('SocialSettings'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 50;
const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

/** Admin social automation settings list page. */
function SettingsPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [editItem, setEditItem] = useState<SocialSetting | null>(null);

    const queryFilters: PlatformSettingsListFilters = {
        page,
        pageSize: PAGE_SIZE
    };

    const { data, isLoading, error } = useSocialSettingsList(queryFilters);

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    const handleEdit = (item: SocialSetting) => {
        setEditItem(item);
    };

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SOCIAL_SETTINGS_MANAGE]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-2xl">
                        {t('social.settings.title' as TranslationKey)}
                    </h1>
                    {pagination && (
                        <span className="text-muted-foreground text-sm">
                            {t('social.settings.total' as TranslationKey, {
                                count: pagination.total
                            })}
                        </span>
                    )}
                </div>

                {/* Loading skeleton */}
                {isLoading && (
                    <div
                        className="space-y-2"
                        data-testid="settings-loading-skeleton"
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
                        data-testid="settings-error"
                    >
                        {t('social.settings.list.error' as TranslationKey)}
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
                        data-testid="settings-empty-state"
                    >
                        <p>{t('social.settings.list.empty' as TranslationKey)}</p>
                    </div>
                )}

                {/* Data table */}
                {!isLoading && !error && items.length > 0 && (
                    <SettingsTable
                        items={items}
                        onEdit={handleEdit}
                    />
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {t('social.settings.list.pagination' as TranslationKey, {
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
                                {t('social.settings.list.prevPage' as TranslationKey)}
                            </button>
                            <button
                                type="button"
                                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {t('social.settings.list.nextPage' as TranslationKey)}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            <SettingEditModal
                open={editItem !== null}
                onOpenChange={(open) => {
                    if (!open) setEditItem(null);
                }}
                item={editItem}
            />
        </RoutePermissionGuard>
    );
}
