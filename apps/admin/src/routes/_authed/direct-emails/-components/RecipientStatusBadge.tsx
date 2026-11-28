/**
 * @file RecipientStatusBadge.tsx
 * @description Status pill for one direct email recipient (HOS-2685). Covers the
 * stored statuses and the `sent | failed | suppressed` subset of a send result.
 */

import { DirectEmailRecipientStatusEnum } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';

/** Tailwind classes per status. */
const STATUS_STYLES: Readonly<Record<DirectEmailRecipientStatusEnum, string>> = {
    [DirectEmailRecipientStatusEnum.SENT]: 'border-info/30 bg-info/15 text-info',
    [DirectEmailRecipientStatusEnum.FAILED]:
        'border-destructive/30 bg-destructive/15 text-destructive',
    [DirectEmailRecipientStatusEnum.SUPPRESSED]: 'border-warning/30 bg-warning/15 text-warning',
    [DirectEmailRecipientStatusEnum.DELIVERED]: 'border-success/30 bg-success/15 text-success',
    [DirectEmailRecipientStatusEnum.OPENED]: 'border-success/30 bg-success/15 text-success',
    [DirectEmailRecipientStatusEnum.BOUNCED]:
        'border-destructive/30 bg-destructive/15 text-destructive'
};

/** Props for RecipientStatusBadge. */
export interface RecipientStatusBadgeProps {
    readonly status: DirectEmailRecipientStatusEnum;
}

/**
 * Colored, translated status pill.
 *
 * @param props - RecipientStatusBadgeProps
 */
export function RecipientStatusBadge({ status }: RecipientStatusBadgeProps) {
    const { t } = useTranslations();
    return (
        <span
            data-status={status}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs ${STATUS_STYLES[status]}`}
        >
            {t(`admin-direct-email.status.${status}` as const)}
        </span>
    );
}
