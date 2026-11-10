/**
 * @file transforms-venue-review-dimensions.test.ts
 * @description `toVenueDetailPageProps` must pass the public review-dimension
 * data through the defensive mappers (HOS-1866 / 6.6). A raw value that is not
 * shaped like the payload becomes absent instead of reaching the page.
 */

import { describe, expect, it } from 'vitest';
import { toVenueDetailPageProps } from '../../../src/lib/api/transforms';

/** The smallest payload the transform needs to produce a detail object. */
function makeItem(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        slug: 'la-parrilla',
        name: 'La Parrilla',
        ...extra
    };
}

describe('toVenueDetailPageProps — review dimensions (TEST:6.6:4)', () => {
    it('maps valid rating and reviewSectionStates', () => {
        const result = toVenueDetailPageProps({
            item: makeItem({
                rating: {
                    food: { average: 5, count: 1 },
                    service: { average: 4.2, count: 2 }
                },
                reviewSectionStates: { menu: { state: 'absent' } }
            })
        });

        expect(result.rating).toEqual({
            food: { average: 5, count: 1 },
            service: { average: 4.2, count: 2 }
        });
        expect(result.reviewSectionStates).toEqual({ menu: { state: 'absent' } });
    });

    it('leaves both undefined when the payload omits them', () => {
        const result = toVenueDetailPageProps({ item: makeItem() });

        expect(result.rating).toBeUndefined();
        expect(result.reviewSectionStates).toBeUndefined();
    });

    it('drops malformed entries instead of surfacing the raw payload', () => {
        const result = toVenueDetailPageProps({
            item: makeItem({
                rating: {
                    food: { average: 'high', count: 'many' },
                    service: { average: 4, count: 2 }
                },
                reviewSectionStates: {
                    menu: { state: 'locked' },
                    broken: 'nope'
                }
            })
        });

        expect(result.rating).toEqual({ service: { average: 4, count: 2 } });
        expect(result.reviewSectionStates).toBeUndefined();
    });

    it('leaves both undefined when the raw values are garbage', () => {
        const result = toVenueDetailPageProps({
            item: makeItem({ rating: 'garbage', reviewSectionStates: 42 })
        });

        expect(result.rating).toBeUndefined();
        expect(result.reviewSectionStates).toBeUndefined();
    });
});
