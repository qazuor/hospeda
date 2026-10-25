/**
 * @file ListingModerationCard.tsx
 * The listing's publication state and its moderation control on the three
 * listing detail routes (HOS-589/HOS-686 AC-26; actions since HOS-1684).
 *
 * HOS-1641 (Coord-424) left this card read-only, because the old inline select
 * posted `{ moderationState }`, a body the action-based endpoint answered with
 * 400. HOS-1684 gives the panel its control back: one button per moderation
 * ACTION the listing's state admits (`getAvailableModerationActions`), each
 * opening its confirmation with the reason, and posting through
 * `useModerateListingMutation` to `POST /api/v1/admin/{plural}/{id}/moderate`.
 *
 * Gated by `LISTING_MODERATE`, the single moderation permission (AC:V6:12).
 * After an action the card shows what the API returned — the new state and
 * whether a fix request is open — instead of guessing it: a `LIFT` may end in
 * `DRAFT`, `UNPUBLISHED_BY_BILLING` or `PUBLISHED`.
 */

import { PermissionEnum, type PublicationStatusEnum } from '@repo/schemas';
import { PermissionGate } from '@/components/auth/PermissionGate';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { getPublicationStatusBadgeOptions } from '../config/publication-status-options';
import type { PurgeListingVertical } from '../hooks/usePurgeListingOnRequestMutation';
import { ListingModerationActions } from './ListingModerationActions';

/** Props for {@link ListingModerationCard}. RO-RO pattern. */
export interface ListingModerationCardProps {
    /** Vertical of the listing. */
    readonly vertical: PurgeListingVertical;
    /** UUID of the listing. */
    readonly entityId: string;
    /** Listing name shown in the confirmation; falls back to the id upstream. */
    readonly entityName: string;
    /** The listing's `publicationStatus`; `undefined` while loading. */
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}

/**
 * Renders the listing's publication state and, for an admin with
 * `LISTING_MODERATE`, one button per moderation action the state admits.
 *
 * @param props - The listing's vertical, id, name and publication state.
 */
export function ListingModerationCard({
    vertical,
    entityId,
    entityName,
    publicationStatus
}: ListingModerationCardProps) {
    const { t } = useTranslations();

    const badgeOptions = getPublicationStatusBadgeOptions({ t: t as ColumnTFunction });

    return (
        <Card data-testid="listing-moderation">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.listingModeration.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {publicationStatus ? (
                    <BadgeCell
                        value={publicationStatus}
                        options={badgeOptions}
                    />
                ) : null}

                <PermissionGate permissions={[PermissionEnum.LISTING_MODERATE]}>
                    <ListingModerationActions
                        vertical={vertical}
                        entityId={entityId}
                        entityName={entityName}
                    />
                </PermissionGate>
            </CardContent>
        </Card>
    );
}
