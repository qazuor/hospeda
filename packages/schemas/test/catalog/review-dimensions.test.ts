import { describe, expect, it } from 'vitest';
import type { ListingSectionId } from '../../src/catalog/listing-catalog.ids.js';
import { validateReviewDimensions } from '../../src/catalog/review-dimensions.js';

describe('review dimensions', () => {
    const absentMenu = new Map<
        ListingSectionId<'venue'>,
        { state: 'absent' | 'locked' | 'available' }
    >([['menu', { state: 'absent' }]]);
    const lockedMenu = new Map<
        ListingSectionId<'venue'>,
        { state: 'absent' | 'locked' | 'available' }
    >([['menu', { state: 'locked' }]]);

    it('rejects food when the bound section is absent', () => {
        expect(
            validateReviewDimensions({
                vertical: 'venue',
                sectionStates: absentMenu,
                rating: { food: 4 }
            })
        ).toEqual({ ok: false, reason: 'DIMENSION_NOT_APPLICABLE', field: 'rating.food' });
    });

    it('allows food when the bound section is locked', () => {
        expect(
            validateReviewDimensions({
                vertical: 'venue',
                sectionStates: lockedMenu,
                rating: { food: 4 }
            })
        ).toEqual({ ok: true });
    });

    it('rejects dimensions outside the vertical by shape, through the validator', () => {
        expect(
            validateReviewDimensions({
                vertical: 'venue',
                sectionStates: lockedMenu,
                rating: { workQuality: 4 }
            })
        ).toEqual({ ok: false, reason: 'INVALID_RATING', field: 'rating' });
    });

    it.each([
        0,
        null,
        4.5
    ])('rejects a malformed venue vote (%s) by shape, through the validator', (food) => {
        expect(
            validateReviewDimensions({
                vertical: 'venue',
                sectionStates: lockedMenu,
                rating: { food }
            })
        ).toEqual({ ok: false, reason: 'INVALID_RATING', field: 'rating' });
    });

    it('accepts the unchanged experience rating shape including zero', () => {
        expect(
            validateReviewDimensions({
                vertical: 'experience',
                sectionStates: {},
                rating: { food: 0, service: 0, ambiance: 0, value: 0 }
            })
        ).toEqual({ ok: true });
    });
});
