/**
 * @file SocialPostStatusBadge.tsx
 * @description Color-coded badge for social post pipeline status (SPEC-254 T-039).
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { SocialPostStatusEnum } from '@repo/schemas';

/** Props for {@link SocialPostStatusBadge}. */
export interface SocialPostStatusBadgeProps {
    readonly status: string;
}

/** Maps pipeline status to Tailwind color classes. */
const STATUS_CLASS_MAP: Record<string, string> = {
    [SocialPostStatusEnum.DRAFT]: 'bg-muted text-muted-foreground',
    [SocialPostStatusEnum.NEEDS_REVIEW]: 'bg-yellow-100 text-yellow-800',
    [SocialPostStatusEnum.APPROVED]: 'bg-blue-100 text-blue-800',
    [SocialPostStatusEnum.SCHEDULED]: 'bg-indigo-100 text-indigo-800',
    [SocialPostStatusEnum.READY_TO_PUBLISH]: 'bg-purple-100 text-purple-800',
    [SocialPostStatusEnum.PUBLISHING]: 'bg-orange-100 text-orange-800',
    [SocialPostStatusEnum.PUBLISHED]: 'bg-green-100 text-green-800',
    [SocialPostStatusEnum.FAILED]: 'bg-red-100 text-red-800',
    [SocialPostStatusEnum.PAUSED]: 'bg-gray-100 text-gray-600',
    [SocialPostStatusEnum.ARCHIVED]: 'bg-gray-100 text-gray-400 line-through'
};

/**
 * Color-coded badge for the social post pipeline status.
 *
 * @param props - {@link SocialPostStatusBadgeProps}
 */
export function SocialPostStatusBadge({ status }: SocialPostStatusBadgeProps) {
    const { t } = useTranslations();
    const colorClass = STATUS_CLASS_MAP[status] ?? 'bg-muted text-muted-foreground';

    return (
        <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ${colorClass}`}
            data-testid={`status-badge-${status}`}
        >
            {t(`social.posts.status.${status}` as TranslationKey)}
        </span>
    );
}
