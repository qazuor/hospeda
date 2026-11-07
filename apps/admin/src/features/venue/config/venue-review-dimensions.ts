/**
 * @file venue-review-dimensions.ts
 * Dimensions voted on a venue review, for the admin moderation panel (HOS-1877).
 *
 * The catalog (`REVIEW_RULES.venue.dimensions`) decides the dimensions, their
 * order and their labels. Nothing here compares, indexes or searches dimension
 * values, and nothing here compares the vertical (G-FAC-05): the review's
 * `rating` is read with each catalog dimension's own id.
 */

import type { VenueReview } from '@repo/schemas';
import { REVIEW_RULES } from '@repo/schemas';

/** One dimension the reviewer actually voted. */
export interface VenueReviewDimension {
    /** Catalog dimension id (the key present in the review's `rating`). */
    readonly id: string;
    /** i18n key of the dimension's label, from the catalog. */
    readonly labelKey: string;
    /** The vote, an integer between 1 and 5. */
    readonly value: number;
}

/** Vertical whose review catalog feeds this module. */
const VENUE_VERTICAL = 'venue' as const;

/**
 * Whether a breakdown value is a usable dimension vote.
 *
 * The schema already rejects `0`, `null` and non-integers, but `items` reaches
 * the panel as `unknown[]` after an unchecked cast, so the helper tolerates a
 * malformed payload instead of rendering `0/5`.
 *
 * @param value - One value read from the review's `rating`.
 * @returns `true` when the value is a finite number of at least 1.
 */
function isVote(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 1;
}

/**
 * Resolves the dimensions voted on a venue review, in catalog order.
 *
 * A missing key means the reviewer did not vote that dimension (DEC-FAC-071),
 * so an absent key is simply not listed. A key the catalog does not declare is
 * ignored: there is no local dimension list. A dimension bound to a section is
 * listed when voted — the moderator sees what the reviewer submitted.
 *
 * @param input - The review's optional breakdown.
 * @param input.rating - `VenueReview['rating']` (`null`, `undefined` or empty
 *   when the reviewer submitted no breakdown).
 * @returns The voted dimensions with their catalog labels, in catalog order.
 */
export function resolveVenueReviewDimensions({
    rating
}: {
    readonly rating: VenueReview['rating'];
}): readonly VenueReviewDimension[] {
    return REVIEW_RULES[VENUE_VERTICAL].dimensions.flatMap((dimension) => {
        const value = rating?.[dimension.id];
        return isVote(value) ? [{ id: dimension.id, labelKey: dimension.labelKey, value }] : [];
    });
}
