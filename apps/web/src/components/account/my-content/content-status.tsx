/**
 * @file content-status.tsx
 * @description The three status axes of an authored event or post, as
 * `ContentCard` statuses (HOS-2505). The axes are independent and are never
 * collapsed into one «published» flag (HOS-374 §7.6.1): content is public
 * ONLY when it reads APPROVED + PUBLIC + ACTIVE. Each axis carries its label
 * and a word, so color is never the only signal.
 */

import { type ContentCardStatus, StatusPill, type StatusTone } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';

const MODERATION_TONES: Readonly<Record<string, StatusTone>> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger'
};

const VISIBILITY_TONES: Readonly<Record<string, StatusTone>> = {
    PUBLIC: 'success',
    PRIVATE: 'neutral',
    RESTRICTED: 'warning'
};

const LIFECYCLE_TONES: Readonly<Record<string, StatusTone>> = {
    DRAFT: 'warning',
    ACTIVE: 'success',
    ARCHIVED: 'neutral'
};

/** The three wire values of an authored item. */
export interface ContentStatusInput {
    readonly locale: SupportedLocale;
    readonly moderationState: string;
    readonly visibility: string;
    readonly lifecycleState: string;
}

/**
 * Builds the moderation, visibility and lifecycle statuses of an item.
 *
 * An unknown wire value keeps its raw text with a neutral tone, so a new enum
 * value shows up instead of disappearing.
 *
 * @param input - See {@link ContentStatusInput}.
 * @returns The three `ContentCard` statuses, in reading order.
 */
export function buildContentStatuses({
    locale,
    moderationState,
    visibility,
    lifecycleState
}: ContentStatusInput): readonly ContentCardStatus[] {
    const t = createT(locale);
    const axis = ({
        key,
        value,
        tones
    }: {
        readonly key: 'moderation' | 'visibility' | 'lifecycle';
        readonly value: string;
        readonly tones: Readonly<Record<string, StatusTone>>;
    }): ContentCardStatus => {
        const tone = tones[value];
        return {
            key,
            label: t(`account.myContent.status.${key}.label`),
            value: (
                <StatusPill tone={tone ?? 'neutral'}>
                    {tone ? t(`account.myContent.status.${key}.${value}`) : value}
                </StatusPill>
            )
        };
    };
    return [
        axis({ key: 'moderation', value: moderationState, tones: MODERATION_TONES }),
        axis({ key: 'visibility', value: visibility, tones: VISIBILITY_TONES }),
        axis({ key: 'lifecycle', value: lifecycleState, tones: LIFECYCLE_TONES })
    ];
}
