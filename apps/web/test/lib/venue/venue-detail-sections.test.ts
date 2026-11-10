/**
 * @file venue-detail-sections.test.ts
 * @description Unit tests for the venue detail body section registry and its
 * catalog ordering (HOS-1787 leaf 6.1, TEST:6.1:3).
 *
 * The real catalog already arrives sorted, so the "it sorts" assertion uses a
 * reversed copy on purpose: filtering alone would pass with the real array.
 */

import { LISTING_SECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    orderVenueDetailSections,
    VENUE_DETAIL_SECTION_BODY
} from '../../../src/lib/venue/venue-detail-sections';

const EXPECTED_ORDER = [
    'basicInfo',
    'openingHours',
    'amenities',
    'contact',
    'menu',
    'dailySpecials',
    'venueEvents',
    'faqs',
    'nightInfo'
] as const;

const EXCLUDED = ['price', 'media', 'translations'] as const;

describe('VENUE_DETAIL_SECTION_BODY', () => {
    it('declares exactly the body sections as true and the fixed ones as false', () => {
        for (const id of EXPECTED_ORDER) {
            expect(VENUE_DETAIL_SECTION_BODY[id]).toBe(true);
        }
        for (const id of EXCLUDED) {
            expect(VENUE_DETAIL_SECTION_BODY[id]).toBe(false);
        }
    });
});

describe('orderVenueDetailSections (TEST:6.1:3)', () => {
    it('(a) returns exactly the body ids in catalog order for the real catalog', () => {
        expect(orderVenueDetailSections()).toEqual([...EXPECTED_ORDER]);
    });

    it('(b) sorts by catalog order even when the input is reversed', () => {
        const reversed = [...LISTING_SECTIONS.venue].reverse();

        expect(orderVenueDetailSections({ sections: reversed })).toEqual([...EXPECTED_ORDER]);
    });

    it('(c) never returns price, media or translations', () => {
        const ids = orderVenueDetailSections();

        for (const excluded of EXCLUDED) {
            expect(ids).not.toContain(excluded);
        }

        const reversedIds = orderVenueDetailSections({
            sections: [...LISTING_SECTIONS.venue].reverse()
        });
        for (const excluded of EXCLUDED) {
            expect(reversedIds).not.toContain(excluded);
        }
    });
});
