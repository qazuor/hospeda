/**
 * @file VenueReviewDimensions.tsx
 * Read-only list of the dimensions a venue reviewer voted (HOS-1877, AC:7:6).
 *
 * The panel shows only what the reviewer submitted: it never edits dimensions
 * and never compares verticals, listing types or sections. A review without a
 * breakdown renders nothing, so the card keeps showing the scalar
 * `overallRating` alone.
 */

import type { TranslationKey } from '@repo/i18n';
import type { VenueReview } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import { resolveVenueReviewDimensions } from '../config/venue-review-dimensions';

/** Props accepted by {@link VenueReviewDimensions}. */
export interface VenueReviewDimensionsProps {
    /** Optional per-dimension breakdown of the review. */
    readonly rating: VenueReview['rating'];
}

/**
 * Lists the dimensions a venue review voted, in catalog order.
 *
 * @param props - Component properties.
 * @param props.rating - The review's optional breakdown.
 * @returns The list, or `null` when the reviewer voted no dimension.
 */
export function VenueReviewDimensions({ rating }: VenueReviewDimensionsProps) {
    const { t } = useTranslations();
    const dimensions = resolveVenueReviewDimensions({ rating });

    if (dimensions.length === 0) return null;

    return (
        <ul
            aria-label={t('admin-entities.venue.reviews.dimensionsLabel')}
            className="mb-4 space-y-1 text-muted-foreground text-sm"
        >
            {dimensions.map((dimension) => (
                <li
                    key={dimension.id}
                    className="flex items-center justify-between gap-2"
                >
                    <span>{t(dimension.labelKey as TranslationKey)}</span>
                    <span>{dimension.value}/5</span>
                </li>
            ))}
        </ul>
    );
}
