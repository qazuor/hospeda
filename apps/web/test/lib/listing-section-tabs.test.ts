import { describe, expect, it } from 'vitest';
import { LISTING_DETAIL_SLOT_IDS } from '@/lib/listing-detail/listing-detail-order';
import {
    buildListingSectionTabs,
    getListingSectionTabLabelKey,
    LISTING_SECTION_IDS,
    LISTING_SECTION_KEYS
} from '@/lib/listing-section-tabs';

describe('buildListingSectionTabs', () => {
    it('keeps page order and skips absent sections (AC-2.1)', () => {
        const tabs = buildListingSectionTabs({
            present: { reviews: true, photos: true, amenities: false, location: true }
        });

        expect(tabs.map((tab) => tab.key)).toEqual(['photos', 'location', 'reviews']);
    });

    it('links each tab to the stable section id', () => {
        const tabs = buildListingSectionTabs({
            present: {
                photos: true,
                details: true,
                amenities: true,
                hours: true,
                location: true,
                reviews: true,
                host: true,
                contact: true
            }
        });

        expect(tabs.map((tab) => tab.id)).toEqual([
            'listing-photos',
            'listing-details',
            'listing-amenities',
            'listing-hours',
            'listing-location',
            'listing-reviews',
            'listing-host',
            'listing-contact'
        ]);
        expect(tabs.map((tab) => tab.id)).toEqual(Object.values(LISTING_SECTION_IDS));
    });

    it('flags narrow-layout-only sections', () => {
        const tabs = buildListingSectionTabs({
            present: { photos: true, host: true },
            hideOnDesktop: ['host']
        });

        expect(tabs.map((tab) => tab.hideOnDesktop)).toEqual([false, true]);
    });

    it('returns no tabs when nothing is present', () => {
        expect(buildListingSectionTabs({ present: {} })).toEqual([]);
    });

    it('AC-5: with every key present, follows the slot order', () => {
        // Arrange
        const present = Object.fromEntries(LISTING_SECTION_KEYS.map((key) => [key, true]));

        // Act
        const tabs = buildListingSectionTabs({ present });

        // Assert
        expect(tabs.map((tab) => tab.key)).toEqual([
            'photos',
            'details',
            'amenities',
            'hours',
            'location',
            'reviews',
            'host',
            'contact'
        ]);
    });
});

describe('LISTING_SECTION_IDS (HOS-2579 §6.1.2)', () => {
    it('keeps the tab ids that are slot wrapper ids equal to them', () => {
        expect(LISTING_SECTION_IDS.hours).toBe(LISTING_DETAIL_SLOT_IDS.hours);
        expect(LISTING_SECTION_IDS.location).toBe(LISTING_DETAIL_SLOT_IDS.location);
        expect(LISTING_SECTION_IDS.reviews).toBe(LISTING_DETAIL_SLOT_IDS.reviews);
        expect(LISTING_SECTION_IDS.host).toBe(LISTING_DETAIL_SLOT_IDS.host);
        expect(LISTING_SECTION_IDS.contact).toBe(LISTING_DETAIL_SLOT_IDS.contact);
    });

    it('keeps the historical ids of the aliased tabs', () => {
        expect(LISTING_SECTION_IDS.photos).toBe('listing-photos');
        expect(LISTING_SECTION_IDS.details).toBe('listing-details');
        expect(LISTING_SECTION_IDS.amenities).toBe('listing-amenities');
    });
});

describe('getListingSectionTabLabelKey (AC-6)', () => {
    it('labels the venue slot-4 tab «Lo que ofrece» (offers)', () => {
        expect(getListingSectionTabLabelKey({ key: 'amenities', vertical: 'venue' })).toBe(
            'offers'
        );
    });

    it('keeps the amenities label on accommodation and experience', () => {
        expect(getListingSectionTabLabelKey({ key: 'amenities', vertical: 'accommodation' })).toBe(
            'amenities'
        );
        expect(getListingSectionTabLabelKey({ key: 'amenities', vertical: 'experience' })).toBe(
            'amenities'
        );
    });

    it('leaves every other key as is', () => {
        expect(getListingSectionTabLabelKey({ key: 'hours', vertical: 'venue' })).toBe('hours');
        expect(getListingSectionTabLabelKey({ key: 'contact', vertical: 'experience' })).toBe(
            'contact'
        );
    });
});
