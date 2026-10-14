/**
 * @file ListingModerationCard.tsx
 * The listing's publication state on the gastronomy and experience detail
 * routes (HOS-686 AC-26; read-only since HOS-1641, Coord-424).
 *
 * Until HOS-1641 this card was an inline select that posted
 * `{ moderationState }` to `POST /:id/moderate`. That column no longer exists,
 * and the endpoint now takes a moderation ACTION (`REQUEST_FIX`, `TAKE_DOWN`,
 * `LIFT`, `CLOSE_FIX_REQUEST`) with its reason, so the select already answered
 * 400. The card now shows the listing's single `publicationStatus` — where a
 * moderation is visible as `MODERATED` — and mutates nothing.
 *
 * The action-based moderation control arrives with HOS-1684.
 */

import type { PublicationStatusEnum } from '@repo/schemas';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { getPublicationStatusBadgeOptions } from '../config/publication-status-options';

/** Props for {@link ListingModerationCard}. RO-RO pattern. */
export interface ListingModerationCardProps {
    /** The listing's `publicationStatus`; `undefined` while loading. */
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}

/**
 * Renders the listing's publication state as a read-only badge.
 *
 * @param props - The listing's publication state.
 */
export function ListingModerationCard({ publicationStatus }: ListingModerationCardProps) {
    const { t } = useTranslations();

    return (
        <Card data-testid="listing-moderation">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.columns.status')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {publicationStatus ? (
                    <BadgeCell
                        value={publicationStatus}
                        options={getPublicationStatusBadgeOptions({ t: t as ColumnTFunction })}
                    />
                ) : null}
            </CardContent>
        </Card>
    );
}
