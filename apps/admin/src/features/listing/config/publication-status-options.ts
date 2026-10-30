/**
 * @file publication-status-options.ts
 * The panel's single reading of a listing's publication state (HOS-1641).
 *
 * Accommodations, venue listings and experiences no longer carry
 * `lifecycleState`, `visibility` or `moderationState`: their state is ONE
 * `publicationStatus` (`PublicationStatusEnum`, six values). Every list of the
 * three verticals filters and shows that column through this module, so the
 * filter, the badge and the peek drawer cannot drift apart.
 *
 * The panel only READS the state. It is written exclusively by the publication
 * transitions (PB1-PB13); no list cell edits it inline.
 */

import type { TranslationKey } from '@repo/i18n';
import { PublicationStatusEnum } from '@repo/schemas';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, type BadgeOption } from '@/components/table/DataTable';

/** i18n key and badge color of one publication state. */
interface PublicationStatusPresentation {
    readonly labelKey: TranslationKey;
    readonly color: BadgeColor;
}

/**
 * Presentation of each publication state. A `Record` over the enum, so a
 * seventh state cannot be added without the panel learning how to show it.
 */
const PUBLICATION_STATUS_PRESENTATION: Readonly<
    Record<PublicationStatusEnum, PublicationStatusPresentation>
> = {
    [PublicationStatusEnum.DRAFT]: {
        labelKey: 'admin-filters.publicationStatus.draft',
        color: BadgeColor.GRAY
    },
    [PublicationStatusEnum.PUBLISHED]: {
        labelKey: 'admin-filters.publicationStatus.published',
        color: BadgeColor.GREEN
    },
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: {
        labelKey: 'admin-filters.publicationStatus.unpublishedByBilling',
        color: BadgeColor.YELLOW
    },
    [PublicationStatusEnum.ARCHIVED]: {
        labelKey: 'admin-filters.publicationStatus.archived',
        color: BadgeColor.ORANGE
    },
    [PublicationStatusEnum.MODERATED]: {
        labelKey: 'admin-filters.publicationStatus.moderated',
        color: BadgeColor.PINK
    },
    [PublicationStatusEnum.PURGED]: {
        labelKey: 'admin-filters.publicationStatus.purged',
        color: BadgeColor.RED
    }
};

/** The six states, in the enum's declaration order. */
const PUBLICATION_STATUSES = Object.values(PublicationStatusEnum);

/**
 * Options of the `status` filter of a listing list: the six publication
 * states. "All" is the filter select's own empty choice, which sends no
 * `status` at all (the API default `'all'`).
 *
 * @returns One `{ value, labelKey }` option per publication state.
 */
export function getPublicationStatusFilterOptions(): ReadonlyArray<{
    readonly value: PublicationStatusEnum;
    readonly labelKey: TranslationKey;
}> {
    return PUBLICATION_STATUSES.map((value) => ({
        value,
        labelKey: PUBLICATION_STATUS_PRESENTATION[value].labelKey
    }));
}

/**
 * Localized badge options for a `publicationStatus` column or header badge.
 *
 * @param args.t - The panel's translation function.
 * @returns One badge option per publication state.
 */
export function getPublicationStatusBadgeOptions({
    t
}: {
    readonly t: ColumnTFunction;
}): readonly BadgeOption[] {
    return PUBLICATION_STATUSES.map((value) => ({
        value,
        label: t(PUBLICATION_STATUS_PRESENTATION[value].labelKey),
        color: PUBLICATION_STATUS_PRESENTATION[value].color
    }));
}
