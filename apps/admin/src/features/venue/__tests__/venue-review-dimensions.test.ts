/**
 * TEST:7.5:1 (AC:7:6) — the moderation view lists the dimensions a venue
 * reviewer voted, resolved from the catalog.
 *
 * What would make it silently wrong:
 *  - listing every catalog dimension even when the reviewer voted none;
 *  - reordering the catalog or inventing labels instead of reading them;
 *  - rendering a `0` vote;
 *  - returning a dimension the catalog does not declare.
 */

import { REVIEW_RULES, type VenueReview } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveVenueReviewDimensions } from '../config/venue-review-dimensions';

/** Builds a breakdown with a key the schema never declares, without a cast at the call site. */
const unknownKeyRating: Record<string, number> = { bogus: 3 };

describe('resolveVenueReviewDimensions (TEST:7.5:1 / AC:7:6)', () => {
    it('returns only the voted dimensions, in catalog order, with catalog label keys', () => {
        const rows = resolveVenueReviewDimensions({ rating: { food: 4, value: 5 } });

        expect(rows).toEqual([
            { id: 'food', labelKey: 'review.dimensions.food', value: 4 },
            { id: 'value', labelKey: 'review.dimensions.value', value: 5 }
        ]);
    });

    it('returns all four when the reviewer voted all four', () => {
        const rows = resolveVenueReviewDimensions({
            rating: { food: 5, service: 4, ambiance: 3, value: 2 }
        });

        expect(rows).toHaveLength(4);
        expect(rows.map((row) => row.id)).toEqual(['food', 'service', 'ambiance', 'value']);
        expect(rows.map((row) => row.value)).toEqual([5, 4, 3, 2]);
    });

    it('returns nothing for a nullish or empty breakdown', () => {
        expect(resolveVenueReviewDimensions({ rating: null })).toEqual([]);
        expect(resolveVenueReviewDimensions({ rating: undefined })).toEqual([]);
        expect(resolveVenueReviewDimensions({ rating: {} })).toEqual([]);
    });

    it('ignores a zero vote and keys the catalog does not declare', () => {
        expect(resolveVenueReviewDimensions({ rating: { service: 0 } })).toEqual([]);
        expect(
            resolveVenueReviewDimensions({
                rating: unknownKeyRating as unknown as VenueReview['rating']
            })
        ).toEqual([]);
    });

    it('lists a dimension bound to a section when the reviewer voted it', () => {
        const rows = resolveVenueReviewDimensions({ rating: { food: 3 } });

        expect(rows).toEqual([{ id: 'food', labelKey: 'review.dimensions.food', value: 3 }]);
    });

    it('follows the catalog: every declared dimension with a vote is returned', () => {
        for (const dimension of REVIEW_RULES.venue.dimensions) {
            const rows = resolveVenueReviewDimensions({
                rating: { [dimension.id]: 5 }
            });

            expect(rows).toEqual([{ id: dimension.id, labelKey: dimension.labelKey, value: 5 }]);
        }
    });
});
