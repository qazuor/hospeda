/**
 * @file review-dimensions-view.test.ts
 * @description Unit tests for the pure review-dimension projections
 * (HOS-1866 / 6.6, AC:6:10). The catalog is the single source of truth: the
 * offered set follows the bound section's public state and the average set
 * follows the aggregate keys, always in catalog order.
 */

import { describe, expect, it } from 'vitest';
import {
    parsePublicDimensionRatings,
    parsePublicReviewSectionStates,
    resolveDimensionAverages,
    resolveOfferedReviewDimensions
} from '../../../src/lib/venue/review-dimensions-view';

const VERTICAL = 'venue' as const;

describe('resolveOfferedReviewDimensions (TEST:6.6:1)', () => {
    it('drops the bound dimension when its section is absent', () => {
        const offered = resolveOfferedReviewDimensions({
            vertical: VERTICAL,
            sectionStates: { menu: { state: 'absent' } }
        });

        expect(offered.map((dimension) => dimension.id)).toEqual(['service', 'ambiance', 'value']);
        expect(offered.every((dimension) => dimension.id !== 'food')).toBe(true);
    });

    it('offers every dimension when the bound section is available', () => {
        const offered = resolveOfferedReviewDimensions({
            vertical: VERTICAL,
            sectionStates: { menu: { state: 'available' } }
        });

        expect(offered.map((dimension) => dimension.id)).toEqual([
            'food',
            'service',
            'ambiance',
            'value'
        ]);
    });

    it('offers every dimension when locked was collapsed to available upstream', () => {
        const offered = resolveOfferedReviewDimensions({
            vertical: VERTICAL,
            sectionStates: { menu: { state: 'available' } }
        });

        expect(offered.map((dimension) => dimension.id)).toContain('food');
    });

    it('offers every dimension when the map is absent (older cached payload)', () => {
        const offered = resolveOfferedReviewDimensions({ vertical: VERTICAL });

        expect(offered.map((dimension) => dimension.id)).toEqual([
            'food',
            'service',
            'ambiance',
            'value'
        ]);
    });

    it('reads every label key from the catalog', () => {
        const offered = resolveOfferedReviewDimensions({ vertical: VERTICAL });

        expect(offered.map((dimension) => dimension.labelKey)).toEqual([
            'review.dimensions.food',
            'review.dimensions.service',
            'review.dimensions.ambiance',
            'review.dimensions.value'
        ]);
    });
});

describe('resolveDimensionAverages (TEST:6.6:2)', () => {
    it('skips a dimension whose key is absent from the aggregate', () => {
        const averages = resolveDimensionAverages({
            vertical: VERTICAL,
            rating: { service: { average: 4, count: 2 } }
        });

        expect(averages.map((dimension) => dimension.id)).toEqual(['service']);
    });

    it('skips a dimension with zero votes', () => {
        const averages = resolveDimensionAverages({
            vertical: VERTICAL,
            rating: {
                food: { average: 5, count: 0 },
                service: { average: 4, count: 1 }
            }
        });

        expect(averages.map((dimension) => dimension.id)).toEqual(['service']);
    });

    it('returns the label key of a voted dimension', () => {
        const averages = resolveDimensionAverages({
            vertical: VERTICAL,
            rating: { value: { average: 3.5, count: 4 } }
        });

        expect(averages).toEqual([
            {
                id: 'value',
                labelKey: 'review.dimensions.value',
                average: 3.5,
                count: 4
            }
        ]);
    });

    it('returns an empty list for an absent or garbage aggregate', () => {
        expect(resolveDimensionAverages({ vertical: VERTICAL })).toEqual([]);
        expect(resolveDimensionAverages({ vertical: VERTICAL, rating: null })).toEqual([]);
        expect(resolveDimensionAverages({ vertical: VERTICAL, rating: 'nope' })).toEqual([]);
        expect(
            resolveDimensionAverages({
                vertical: VERTICAL,
                rating: { food: { average: 'high', count: 2 } }
            })
        ).toEqual([]);
    });

    it('follows the catalog order, not the object key order', () => {
        const averages = resolveDimensionAverages({
            vertical: VERTICAL,
            rating: {
                value: { average: 3, count: 1 },
                ambiance: { average: 4, count: 2 },
                service: { average: 5, count: 3 }
            }
        });

        expect(averages.map((dimension) => dimension.id)).toEqual(['service', 'ambiance', 'value']);
    });
});

describe('defensive parsers', () => {
    it('drops ids and entries that are not shaped like the public payload', () => {
        expect(parsePublicReviewSectionStates('nope')).toBeUndefined();
        expect(parsePublicReviewSectionStates({ menu: { state: 'locked' } })).toBeUndefined();
        expect(
            parsePublicReviewSectionStates({
                menu: { state: 'absent' },
                broken: 'nope'
            })
        ).toEqual({ menu: { state: 'absent' } });
        expect(parsePublicDimensionRatings({ food: { average: 5, count: -1 } })).toBeUndefined();
        expect(parsePublicDimensionRatings({ food: { average: 5, count: 1.5 } })).toBeUndefined();
    });
});
