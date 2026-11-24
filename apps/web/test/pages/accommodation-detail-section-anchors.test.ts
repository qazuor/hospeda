import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTING_DETAIL_SLOT_IDS } from '@/lib/listing-detail/listing-detail-order';
import { LISTING_SECTION_IDS, type ListingSectionKey } from '@/lib/listing-section-tabs';

const page = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

/**
 * Where each tab's anchor lives on the accommodation page (HOS-2527; slot
 * wrappers since HOS-2579 §6.1.2). `photos` is an element id inside slot 1,
 * `details` / `amenities` are inner anchors of slots 3 / 4, and the rest ARE
 * the slot wrapper ids. Accommodation has no opening hours (slot 5).
 */
const ANCHOR_SOURCE: Readonly<Partial<Record<ListingSectionKey, string>>> = {
    photos: 'id={LISTING_SECTION_IDS.photos}',
    details: '<ListingDetailSlot name="description" anchorId={LISTING_SECTION_IDS.details}>',
    amenities: '<ListingDetailSlot name="offers" anchorId={LISTING_SECTION_IDS.amenities}>',
    location: '<ListingDetailSlot name="location">',
    reviews: '<ListingDetailSlot name="reviews">',
    host: '<ListingDetailSlot name="host">',
    contact: '<ListingDetailSlot name="contact">'
};

describe('accommodation detail section anchors (HOS-2527, HOS-2579)', () => {
    it.each(Object.entries(ANCHOR_SOURCE))('exposes the stable anchor for %s', (key, source) => {
        expect(page).toContain(source);
        expect(LISTING_SECTION_IDS[key as ListingSectionKey]).toBe(`listing-${key}`);
    });

    it('slot-wrapper tabs point at the wrapper id itself', () => {
        for (const key of ['location', 'reviews', 'host', 'contact'] as const) {
            expect(LISTING_SECTION_IDS[key]).toBe(LISTING_DETAIL_SLOT_IDS[key]);
        }
    });

    it('mounts the tabs once, after the gallery, wired to the same panel', () => {
        expect(page.match(/<ListingSectionTabs/g)).toHaveLength(1);
        expect(page.indexOf('<ListingSectionTabs')).toBeGreaterThan(page.indexOf('<ImageGallery'));
        expect(page).toMatch(/<ListingSectionTabs[^>]*[\s\S]*?panelId=\{panelId\}/);
        expect(page).toContain('galleryId={LISTING_SECTION_IDS.photos}');
    });

    it('keeps the tabs outside every slot wrapper (a sticky element sticks inside its parent)', () => {
        const before = page.slice(0, page.indexOf('<ListingSectionTabs'));
        const opened = (before.match(/<ListingDetailSlot\b/g) ?? []).length;
        const closed = (before.match(/<\/ListingDetailSlot>/g) ?? []).length;

        expect(opened).toBeGreaterThan(0);
        expect(opened).toBe(closed);
    });

    it('keeps WhatsNearbySection inside the location slot, right after LocationSection', () => {
        expect(page).toMatch(
            /<ListingDetailSlot name="location">\s*<LocationSection[\s\S]*?\/>\s*<WhatsNearbySection[^>]*\/>\s*<\/ListingDetailSlot>/
        );
    });

    it('puts location before reviews, reviews before host and host before contact (13-slot order)', () => {
        const at = (needle: string): number => page.indexOf(needle);

        expect(at('<LocationSection')).toBeLessThan(at('<ReviewPreview'));
        expect(at('<ReviewPreview')).toBeLessThan(at('<HostSection'));
        expect(at('<HostSection')).toBeLessThan(at('<ListingContactBlock'));
        expect(at('<ListingContactBlock')).toBeLessThan(at('<FaqAccordion'));
    });

    it('only wraps optional sections when they exist', () => {
        expect(page).toContain('{hasDescriptionSection && (');
        expect(page).toContain('{hasAmenitiesSection && (');
        expect(page).toContain('{hasHostSection && (');
        expect(page).toContain('{contactBlock && (');
    });

    it('adds the contact tab only when the contact block renders', () => {
        expect(page).toMatch(/contact: contactBlock !== null/);
    });
});
