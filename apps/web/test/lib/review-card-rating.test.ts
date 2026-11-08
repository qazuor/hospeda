/**
 * @file review-card-rating.test.ts
 * @description HOS-2082: a review card shows the reviewer's chosen overall
 * rating, never the mean of the voted dimensions.
 */

import { describe, expect, it } from 'vitest';
import { resolveReviewCardRating } from '../../src/lib/review-card-rating';

describe('resolveReviewCardRating (HOS-2082)', () => {
    it('shows overallRating 4 when averageRating is 5 (overall 4 + only service 5)', () => {
        // Arrange / Act
        const rating = resolveReviewCardRating({ overallRating: 4, averageRating: 5 });
        // Assert
        expect(rating).toBe(4);
    });

    it('shows overallRating 4 when averageRating is 4.5 (food 5 + ambiance 4)', () => {
        expect(resolveReviewCardRating({ overallRating: 4, averageRating: 4.5 })).toBe(4);
    });

    it.each([
        undefined,
        null,
        0
    ])('falls back to averageRating when overallRating is %s (legacy rows)', (overallRating) => {
        expect(resolveReviewCardRating({ overallRating, averageRating: 3.5 })).toBe(3.5);
    });

    it('returns null when neither rating is present', () => {
        expect(resolveReviewCardRating({})).toBeNull();
        expect(resolveReviewCardRating({ overallRating: null, averageRating: null })).toBeNull();
    });
});
