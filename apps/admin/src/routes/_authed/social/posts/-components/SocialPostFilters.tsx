/**
 * @file SocialPostFilters.tsx
 * @description Filter bar for the admin social posts list page (SPEC-254 T-039).
 *
 * Provides free-text search, pipeline-status dropdown, approval-status dropdown,
 * and platform dropdown. Follows the same pattern as CommentsFilters.tsx.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { SocialApprovalStatusEnum, SocialPlatformEnum, SocialPostStatusEnum } from '@repo/schemas';

/** Shape of the filter state managed by the parent page. */
export interface SocialPostFiltersValue {
    readonly search: string;
    readonly status: string;
    readonly approvalStatus: string;
    readonly platform: string;
}

/** Props for {@link SocialPostFilters}. */
export interface SocialPostFiltersProps {
    readonly value: SocialPostFiltersValue;
    readonly onChange: (next: SocialPostFiltersValue) => void;
}

/**
 * Filter bar for the social posts list.
 * Uses native HTML elements for consistency with CommentsFilters pattern.
 *
 * @param props - {@link SocialPostFiltersProps}
 */
export function SocialPostFilters({ value, onChange }: SocialPostFiltersProps) {
    const { t } = useTranslations();

    return (
        <div className="flex flex-wrap items-end gap-3">
            {/* Free-text search */}
            <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                <label
                    htmlFor="filter-search"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.search' as TranslationKey)}
                </label>
                <input
                    id="filter-search"
                    type="search"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder={t('social.posts.filters.searchPlaceholder' as TranslationKey)}
                    value={value.search}
                    onChange={(e) => onChange({ ...value, search: e.target.value })}
                />
            </div>

            {/* Pipeline status filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-status"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.status' as TranslationKey)}
                </label>
                <select
                    id="filter-status"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.status}
                    onChange={(e) => onChange({ ...value, status: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all' as TranslationKey)}</option>
                    {Object.values(SocialPostStatusEnum).map((s) => (
                        <option
                            key={s}
                            value={s}
                        >
                            {t(`social.posts.status.${s}` as TranslationKey)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Approval status filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-approval-status"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.approvalStatus' as TranslationKey)}
                </label>
                <select
                    id="filter-approval-status"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.approvalStatus}
                    onChange={(e) => onChange({ ...value, approvalStatus: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all' as TranslationKey)}</option>
                    {Object.values(SocialApprovalStatusEnum).map((s) => (
                        <option
                            key={s}
                            value={s}
                        >
                            {t(`social.posts.approvalStatus.${s}` as TranslationKey)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Platform filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-platform"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.platform' as TranslationKey)}
                </label>
                <select
                    id="filter-platform"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.platform}
                    onChange={(e) => onChange({ ...value, platform: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all' as TranslationKey)}</option>
                    {Object.values(SocialPlatformEnum).map((p) => (
                        <option
                            key={p}
                            value={p}
                        >
                            {t(`social.posts.platforms.${p}` as TranslationKey)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
