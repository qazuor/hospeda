/**
 * @file SocialPostApprovalBadge.tsx
 * @description Color-coded badge for social post approval status (SPEC-254 T-039).
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { SocialApprovalStatusEnum } from '@repo/schemas';

/** Props for {@link SocialPostApprovalBadge}. */
export interface SocialPostApprovalBadgeProps {
    readonly approvalStatus: string;
}

/** Maps approval status to Tailwind color classes. */
const APPROVAL_CLASS_MAP: Record<string, string> = {
    [SocialApprovalStatusEnum.PENDING]: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    [SocialApprovalStatusEnum.APPROVED]: 'bg-green-100 text-green-800',
    [SocialApprovalStatusEnum.REJECTED]: 'bg-red-100 text-red-800',
    [SocialApprovalStatusEnum.CHANGES_REQUESTED]: 'bg-orange-100 text-orange-800'
};

/**
 * Color-coded badge for the social post approval status.
 *
 * @param props - {@link SocialPostApprovalBadgeProps}
 */
export function SocialPostApprovalBadge({ approvalStatus }: SocialPostApprovalBadgeProps) {
    const { t } = useTranslations();
    const colorClass = APPROVAL_CLASS_MAP[approvalStatus] ?? 'bg-muted text-muted-foreground';

    return (
        <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ${colorClass}`}
            data-testid={`approval-badge-${approvalStatus}`}
        >
            {t(`social.posts.approvalStatus.${approvalStatus}` as TranslationKey)}
        </span>
    );
}
