import { describe, expect, it } from 'vitest';
import { buildListingSectionTabs, LISTING_SECTION_IDS } from '@/lib/listing-section-tabs';

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
                location: true,
                reviews: true,
                host: true
            }
        });

        expect(tabs.map((tab) => tab.id)).toEqual([
            'listing-photos',
            'listing-details',
            'listing-amenities',
            'listing-location',
            'listing-reviews',
            'listing-host'
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
});
