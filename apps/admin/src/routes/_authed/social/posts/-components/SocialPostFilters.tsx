/**
 * @file SocialPostFilters.tsx
 * @description Filter bar for the admin social posts list page (SPEC-254 T-039).
 *
 * Provides free-text search, pipeline-status dropdown, approval-status dropdown,
 * platform dropdown, batch dropdown, and campaign dropdown.
 * Follows the same pattern as CommentsFilters.tsx.
 */

import { useSocialBatchesList, useSocialCampaignsList } from '@/hooks/use-social-catalog';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { SocialApprovalStatusEnum, SocialPlatformEnum, SocialPostStatusEnum } from '@repo/schemas';

/** Shape of the filter state managed by the parent page. */
export interface SocialPostFiltersValue {
    readonly search: string;
    readonly status: string;
    readonly approvalStatus: string;
    readonly platform: string;
    readonly batchId: string;
    readonly campaignId: string;
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

    const { data: batchesData } = useSocialBatchesList({ pageSize: 100 });
    const { data: campaignsData } = useSocialCampaignsList({ pageSize: 100 });

    const batches = batchesData?.items ?? [];
    const campaigns = campaignsData?.items ?? [];

    return (
        <div className="flex flex-wrap items-end gap-3">
            {/* Free-text search */}
            <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                <label
                    htmlFor="filter-search"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.search')}
                </label>
                <input
                    id="filter-search"
                    type="search"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder={t('social.posts.filters.searchPlaceholder')}
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
                    {t('social.posts.filters.status')}
                </label>
                <select
                    id="filter-status"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.status}
                    onChange={(e) => onChange({ ...value, status: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all')}</option>
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
                    {t('social.posts.filters.approvalStatus')}
                </label>
                <select
                    id="filter-approval-status"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.approvalStatus}
                    onChange={(e) => onChange({ ...value, approvalStatus: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all')}</option>
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
                    {t('social.posts.filters.platform')}
                </label>
                <select
                    id="filter-platform"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.platform}
                    onChange={(e) => onChange({ ...value, platform: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.all')}</option>
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

            {/* Batch filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-batch"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.batch')}
                </label>
                <select
                    id="filter-batch"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.batchId}
                    onChange={(e) => onChange({ ...value, batchId: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.batchAll')}</option>
                    {batches.map((b) => (
                        <option
                            key={b.id}
                            value={b.id}
                        >
                            {b.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Campaign filter */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-campaign"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.posts.filters.campaign')}
                </label>
                <select
                    id="filter-campaign"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.campaignId}
                    onChange={(e) => onChange({ ...value, campaignId: e.target.value })}
                >
                    <option value="">{t('social.posts.filters.campaignAll')}</option>
                    {campaigns.map((c) => (
                        <option
                            key={c.id}
                            value={c.id}
                        >
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
