/**
 * computeEffectiveRating — unit tests (HOS-1842 / 3.10).
 *
 * The per-review scalar `averageRating` is the mean of the dimensions the
 * reviewer actually voted (votedOnly, DEC-FAC-071). A missing key means "did
 * not vote"; when no dimension is voted the required `overallRating` wins.
 */

import { describe, expect, it } from 'vitest';
import { computeEffectiveRating } from '../../../src/services/venue/venue.review.service';

const venueId = '00000000-0000-4000-a000-000000000002';

function input(overallRating: number, rating?: Record<string, number>) {
    return { venueId, overallRating, ...(rating ? { rating } : {}) } as Parameters<
        typeof computeEffectiveRating
    >[0];
}

describe('computeEffectiveRating', () => {
    it('averages the four voted dimensions', () => {
        expect(
            computeEffectiveRating(input(1, { food: 5, service: 4, ambiance: 4, value: 3 }))
        ).toBe(4);
    });

    it('averages only the dimensions that were voted', () => {
        expect(computeEffectiveRating(input(1, { service: 4, value: 2 }))).toBe(3);
    });

    it('returns the single voted dimension', () => {
        expect(computeEffectiveRating(input(1, { ambiance: 5 }))).toBe(5);
    });

    it('falls back to overallRating when no dimension was voted', () => {
        expect(computeEffectiveRating(input(3, {}))).toBe(3);
    });

    it('falls back to overallRating when there is no breakdown', () => {
        expect(computeEffectiveRating(input(4))).toBe(4);
    });

    it('rounds the mean to two decimals', () => {
        // (5 + 4 + 4) / 3 = 4.333...
        expect(computeEffectiveRating(input(1, { food: 5, service: 4, ambiance: 4 }))).toBe(4.33);
    });
});
