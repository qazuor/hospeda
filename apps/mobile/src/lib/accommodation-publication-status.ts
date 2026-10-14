/**
 * @file accommodation-publication-status.ts
 * @description How the host app shows a listing's publication state (HOS-1641).
 *
 * A listing no longer has `lifecycleState`: its state is ONE `publicationStatus`
 * (`PublicationStatusEnum`, six values). The host list card reads its badge
 * from here, so every state has a label and a tone and none falls through to
 * the raw enum value.
 *
 * @module lib/accommodation-publication-status
 */
import { PublicationStatusEnum } from '@repo/schemas';

/** Visual tone of the state badge; the screen maps it to a theme color. */
export type PublicationStatusTone = 'success' | 'draft' | 'warning' | 'neutral' | 'danger';

/** Badge of one publication state. */
export interface PublicationStatusBadge {
    /** i18n key of the label (`mobile.host.accommodations.status.<STATE>`). */
    readonly labelKey: string;
    /** Tone of the badge background. */
    readonly tone: PublicationStatusTone;
}

/**
 * Badge per publication state. A `Record` over the enum, so a seventh state
 * cannot ship without the app learning how to show it.
 */
const BADGES: Readonly<Record<PublicationStatusEnum, PublicationStatusBadge>> = {
    [PublicationStatusEnum.DRAFT]: {
        labelKey: 'mobile.host.accommodations.status.DRAFT',
        tone: 'draft'
    },
    [PublicationStatusEnum.PUBLISHED]: {
        labelKey: 'mobile.host.accommodations.status.PUBLISHED',
        tone: 'success'
    },
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: {
        labelKey: 'mobile.host.accommodations.status.UNPUBLISHED_BY_BILLING',
        tone: 'warning'
    },
    [PublicationStatusEnum.ARCHIVED]: {
        labelKey: 'mobile.host.accommodations.status.ARCHIVED',
        tone: 'neutral'
    },
    [PublicationStatusEnum.MODERATED]: {
        labelKey: 'mobile.host.accommodations.status.MODERATED',
        tone: 'danger'
    },
    [PublicationStatusEnum.PURGED]: {
        labelKey: 'mobile.host.accommodations.status.PURGED',
        tone: 'danger'
    }
};

/**
 * Returns the badge of a listing's publication state.
 *
 * @param args.status - The listing's `publicationStatus`.
 * @returns Its label key and tone.
 *
 * @example
 * ```ts
 * getPublicationStatusBadge({ status: PublicationStatusEnum.PURGED });
 * // { labelKey: 'mobile.host.accommodations.status.PURGED', tone: 'danger' }
 * ```
 */
export function getPublicationStatusBadge({
    status
}: {
    readonly status: PublicationStatusEnum;
}): PublicationStatusBadge {
    return BADGES[status];
}
