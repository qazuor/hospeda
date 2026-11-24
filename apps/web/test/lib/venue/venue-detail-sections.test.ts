/**
 * @file venue-detail-sections.test.ts
 * @description Unit tests for the venue detail body section registry and its
 * page ordering (HOS-1787 leaf 6.1, TEST:6.1:3; slot order since HOS-2579
 * §6.2.3, AC-2, AC-2b, AC-3).
 *
 * The input-order assertions shuffle the real catalog on purpose: only the
 * slot and then the catalog `order` may decide the output.
 */

import { LISTING_SECTIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { LISTING_DETAIL_SLOTS } from '../../../src/lib/listing-detail/listing-detail-order';
import {
    orderVenueDetailSections,
    VENUE_DETAIL_SECTION_BODY,
    VENUE_SECTION_SLOT,
    venueDetailSectionsInSlot
} from '../../../src/lib/venue/venue-detail-sections';

/** Page order: by slot, catalog `order` breaking ties inside `offers`. */
const EXPECTED_ORDER = [
    'basicInfo',
    'amenities',
    'menu',
    'dailySpecials',
    'venueEvents',
    'nightInfo',
    'openingHours',
    'promotions',
    'location',
    'contact',
    'faqs'
] as const;

/** The catalog ids and their `order`, frozen (AC-3: this spec must not change them). */
const CATALOG_ORDER_SNAPSHOT = [
    ['basicInfo', 1],
    ['location', 2],
    ['openingHours', 3],
    ['price', 4],
    ['amenities', 5],
    ['media', 6],
    ['contact', 7],
    ['menu', 8],
    ['dailySpecials', 9],
    ['venueEvents', 10],
    ['promotions', 11],
    ['faqs', 12],
    ['nightInfo', 13],
    ['translations', 14]
] as const;

// Fixed header/gallery/management sections are outside the in-flow body.
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

describe('orderVenueDetailSections (TEST:6.1:3, HOS-2579 AC-2)', () => {
    it('(a) returns exactly the body ids in slot order for the real catalog', () => {
        expect(orderVenueDetailSections()).toEqual([...EXPECTED_ORDER]);
    });

    it('(b) any input order in, slot order out', () => {
        // Arrange
        const reversed = [...LISTING_SECTIONS.venue].reverse();
        const rotated = [...LISTING_SECTIONS.venue.slice(5), ...LISTING_SECTIONS.venue.slice(0, 5)];

        // Act + Assert
        expect(orderVenueDetailSections({ sections: reversed })).toEqual([...EXPECTED_ORDER]);
        expect(orderVenueDetailSections({ sections: rotated })).toEqual([...EXPECTED_ORDER]);
    });

    it('(c) breaks ties inside one slot by catalog order', () => {
        // Arrange: two `offers` sections whose catalog order is swapped.
        const sections = [
            { id: 'menu', order: 2 },
            { id: 'amenities', order: 9 },
            { id: 'basicInfo', order: 50 }
        ] as const;

        // Act
        const ids = orderVenueDetailSections({ sections });

        // Assert: the slot wins over the catalog order, then the catalog order.
        expect(ids).toEqual(['basicInfo', 'menu', 'amenities']);
    });

    it('(d) never returns price, media or translations', () => {
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

    it('(e) follows LISTING_DETAIL_SLOTS: the slot index never decreases', () => {
        const indexes = orderVenueDetailSections().map((id) =>
            LISTING_DETAIL_SLOTS.indexOf(VENUE_SECTION_SLOT[id])
        );

        expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    });
});

describe('VENUE_SECTION_SLOT (HOS-2579 §6.2.3)', () => {
    it('has exactly the body sections as keys (runtime exhaustiveness)', () => {
        const bodyIds = Object.entries(VENUE_DETAIL_SECTION_BODY)
            .filter(([, painted]) => painted)
            .map(([id]) => id)
            .sort();

        expect(Object.keys(VENUE_SECTION_SLOT).sort()).toEqual(bodyIds);
    });

    it('maps every section to a canonical slot', () => {
        for (const slot of Object.values(VENUE_SECTION_SLOT)) {
            expect(LISTING_DETAIL_SLOTS).toContain(slot);
        }
    });

    it('AC-2b: the menu and the agenda sit in «Lo que ofrece»; promotions alone in slot 6 (D-3)', () => {
        expect(VENUE_SECTION_SLOT.menu).toBe('offers');
        expect(VENUE_SECTION_SLOT.venueEvents).toBe('offers');
        expect(
            Object.entries(VENUE_SECTION_SLOT)
                .filter(([, slot]) => slot === 'promotions')
                .map(([id]) => id)
        ).toEqual(['promotions']);
    });

    it('maps the rest as the spec lists them', () => {
        expect(VENUE_SECTION_SLOT).toEqual({
            basicInfo: 'description',
            amenities: 'offers',
            menu: 'offers',
            dailySpecials: 'offers',
            venueEvents: 'offers',
            nightInfo: 'offers',
            openingHours: 'hours',
            promotions: 'promotions',
            location: 'location',
            contact: 'contact',
            faqs: 'faq'
        });
    });
});

describe('venueDetailSectionsInSlot', () => {
    it('returns the sections of one slot in page order', () => {
        expect(venueDetailSectionsInSlot({ slot: 'offers' })).toEqual([
            'amenities',
            'menu',
            'dailySpecials',
            'venueEvents',
            'nightInfo'
        ]);
        expect(venueDetailSectionsInSlot({ slot: 'promotions' })).toEqual(['promotions']);
    });

    it('returns nothing for a slot the venue does not fill', () => {
        expect(venueDetailSectionsInSlot({ slot: 'host' })).toEqual([]);
        expect(venueDetailSectionsInSlot({ slot: 'policies' })).toEqual([]);
    });
});

describe('the venue catalog (AC-3, NG-8)', () => {
    it('keeps its ids and order unchanged: the editor reads them too', () => {
        expect(LISTING_SECTIONS.venue.map((section) => [section.id, section.order])).toEqual(
            CATALOG_ORDER_SNAPSHOT.map(([id, order]) => [id, order])
        );
    });
});
