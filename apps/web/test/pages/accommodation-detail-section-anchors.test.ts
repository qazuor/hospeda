import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTING_SECTION_IDS } from '@/lib/listing-section-tabs';

const page = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

describe('accommodation detail section anchors (HOS-2527)', () => {
    it.each(Object.entries(LISTING_SECTION_IDS))('exposes the stable anchor for %s', (key, id) => {
        expect(page).toContain(`id={LISTING_SECTION_IDS.${key}}`);
        expect(id).toBe(`listing-${key}`);
    });

    it('mounts the tabs once, after the gallery, wired to the same panel', () => {
        expect(page.match(/<ListingSectionTabs/g)).toHaveLength(1);
        expect(page.indexOf('<ListingSectionTabs')).toBeGreaterThan(page.indexOf('<ImageGallery'));
        expect(page).toMatch(/<ListingSectionTabs[^>]*[\s\S]*?panelId=\{panelId\}/);
        expect(page).toContain('galleryId={LISTING_SECTION_IDS.photos}');
    });

    it('keeps WhatsNearbySection inside the location anchor, right after LocationSection', () => {
        expect(page).toMatch(
            /<div id=\{LISTING_SECTION_IDS\.location\}[^>]*>\s*<LocationSection[\s\S]*?\/>\s*<WhatsNearbySection[^>]*\/>\s*<\/div>/
        );
    });

    it('anchors the host tab on the HostSection, before the location section', () => {
        expect(page).toMatch(/<div id=\{LISTING_SECTION_IDS\.host\}[^>]*>\s*<HostSection/);
        expect(page.indexOf('<HostSection')).toBeLessThan(page.indexOf('<LocationSection'));
    });

    it('only wraps optional sections when they exist', () => {
        expect(page).toContain('{hasDescriptionSection && (');
        expect(page).toContain('{hasAmenitiesSection && (');
    });
});
