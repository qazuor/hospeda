/**
 * @file listing-detail-order.test.ts
 * @description The canonical 13-slot order of listing detail pages and the
 * anchor id of each slot (HOS-2579 §6.1, §6.1.2).
 */

import { describe, expect, it } from 'vitest';
import {
    LISTING_DETAIL_SLOT_IDS,
    LISTING_DETAIL_SLOTS
} from '../../../src/lib/listing-detail/listing-detail-order';

describe('LISTING_DETAIL_SLOTS (HOS-2579 §6.1)', () => {
    it('lists the 13 slots in the spec order', () => {
        expect(LISTING_DETAIL_SLOTS).toStrictEqual([
            'galleryHeader',
            'summary',
            'description',
            'offers',
            'hours',
            'promotions',
            'location',
            'reviews',
            'host',
            'contact',
            'policies',
            'faq',
            'related'
        ]);
    });

    it('has no duplicate slot', () => {
        expect(new Set(LISTING_DETAIL_SLOTS).size).toBe(LISTING_DETAIL_SLOTS.length);
    });
});

describe('LISTING_DETAIL_SLOT_IDS (HOS-2579 §6.1.2)', () => {
    it('has exactly one id per slot', () => {
        expect(Object.keys(LISTING_DETAIL_SLOT_IDS).sort()).toStrictEqual(
            [...LISTING_DETAIL_SLOTS].sort()
        );
    });

    it.each(
        LISTING_DETAIL_SLOTS.map((slot) => [slot])
    )('derives the %s id as listing-<kebab-slot>', (slot) => {
        // Arrange
        const kebab = slot.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

        // Assert
        expect(LISTING_DETAIL_SLOT_IDS[slot]).toBe(`listing-${kebab}`);
    });

    it('keeps the hours and contact ids the tabs will alias (§6.2)', () => {
        expect(LISTING_DETAIL_SLOT_IDS.hours).toBe('listing-hours');
        expect(LISTING_DETAIL_SLOT_IDS.contact).toBe('listing-contact');
        expect(LISTING_DETAIL_SLOT_IDS.galleryHeader).toBe('listing-gallery-header');
    });

    it('ids are unique', () => {
        const ids = Object.values(LISTING_DETAIL_SLOT_IDS);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
