/**
 * @file ModerationStateBadge.tsx
 * @description Reusable badge component for comment moderation states (SPEC-165).
 *
 * Provides consistent visual representation of APPROVED / REJECTED / PENDING
 * states using the Shadcn Badge component with appropriate variants.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { ModerationStatusEnum } from '@repo/schemas';

/** Props for {@link ModerationStateBadge}. */
export interface ModerationStateBadgeProps {
    /** The moderation state to display. */
    readonly state: ModerationStatusEnum | string;
}

const STATE_VARIANT: Readonly<
    Record<ModerationStatusEnum, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'>
> = {
    [ModerationStatusEnum.APPROVED]: 'success',
    [ModerationStatusEnum.REJECTED]: 'destructive',
    [ModerationStatusEnum.PENDING]: 'outline'
};

/**
 * Renders a colored Badge for a comment moderation state.
 * Uses the `comments.moderation.*` i18n keys (SPEC-165 §AC-35).
 *
 * @param props - {@link ModerationStateBadgeProps}
 */
export function ModerationStateBadge({ state }: ModerationStateBadgeProps) {
    const { t } = useTranslations();

    const key = state as ModerationStatusEnum;
    const variant = STATE_VARIANT[key] ?? 'secondary';
    const label =
        key === ModerationStatusEnum.APPROVED
            ? t('comments.moderation.approved')
            : key === ModerationStatusEnum.REJECTED
              ? t('comments.moderation.rejected')
              : t('comments.moderation.pending');

    return <Badge variant={variant}>{label}</Badge>;
}
