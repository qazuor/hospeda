/**
 * @file alojamientos-slug-whats-nearby.test.ts
 * @description HOS-145 T-009 — the accommodation detail page
 * (`[lang]/alojamientos/[slug].astro`) must SSR-fetch nearby POIs via
 * `accommodationsApi.getNearbyPois` and render `WhatsNearbySection`
 * immediately after `LocationSection`, with a fail-soft empty-array
 * fallback (mirroring the `promotionsResult` → `activePromos` pattern).
 *
 * Astro pages/components cannot be rendered through Vitest/jsdom, so this
 * follows the project's established pattern (see
 * `apps/web/test/pages/alojamientos-slug-compare-bar.test.ts`) of asserting
 * on the raw source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SLUG_PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro');

const slugPageSrc = readFileSync(SLUG_PAGE_PATH, 'utf8');

describe('[slug].astro — WhatsNearbySection wiring (HOS-145 T-009)', () => {
    it('imports WhatsNearbySection from the accommodation components dir', () => {
        expect(slugPageSrc).toMatch(
            /import\s+WhatsNearbySection\s+from\s*['"]@\/components\/accommodation\/WhatsNearbySection\.astro['"]/
        );
    });

    it('imports the NearbyPoi type from @repo/schemas', () => {
        expect(slugPageSrc).toMatch(
            /import\s+type\s*\{\s*NearbyPoi\s*\}\s*from\s*['"]@repo\/schemas['"]/
        );
    });

    it('SSR-fetches nearby POIs via accommodationsApi.getNearbyPois({ slug })', () => {
        expect(slugPageSrc).toContain('accommodationsApi.getNearbyPois({ slug })');
    });

    it('extracts nearbyPois with a fail-soft fallback to an empty array', () => {
        // Mirrors the activePromos/extractItems graceful-degradation pattern:
        // Promise.allSettled + extractItems() never throws and defaults to [].
        expect(slugPageSrc).toContain(
            'const nearbyPois = extractItems(nearbyPoisResult) as unknown as NearbyPoi[];'
        );
    });

    it('mounts <WhatsNearbySection pointsOfInterest={nearbyPois} locale={locale} />', () => {
        expect(slugPageSrc).toContain(
            '<WhatsNearbySection pointsOfInterest={nearbyPois} locale={locale} />'
        );
    });

    it('mounts WhatsNearbySection immediately after LocationSection', () => {
        const locationSectionIndex = slugPageSrc.indexOf('<LocationSection');
        const locationSectionCloseIndex = slugPageSrc.indexOf('/>', locationSectionIndex);
        const whatsNearbyIndex = slugPageSrc.indexOf(
            '<WhatsNearbySection pointsOfInterest={nearbyPois} locale={locale} />'
        );

        expect(locationSectionIndex).toBeGreaterThan(-1);
        expect(whatsNearbyIndex).toBeGreaterThan(locationSectionCloseIndex);

        // Nothing else should be rendered between the two (allow only whitespace).
        const between = slugPageSrc.slice(locationSectionCloseIndex + 2, whatsNearbyIndex);
        expect(between.trim()).toBe('');
    });

    it('mounts WhatsNearbySection inside <DetailLayout>...</DetailLayout>', () => {
        const layoutOpenIndex = slugPageSrc.indexOf('<DetailLayout');
        const layoutCloseIndex = slugPageSrc.indexOf('</DetailLayout>');
        const whatsNearbyIndex = slugPageSrc.indexOf(
            '<WhatsNearbySection pointsOfInterest={nearbyPois} locale={locale} />'
        );

        expect(layoutOpenIndex).toBeGreaterThan(-1);
        expect(layoutCloseIndex).toBeGreaterThan(-1);
        expect(whatsNearbyIndex).toBeGreaterThan(layoutOpenIndex);
        expect(whatsNearbyIndex).toBeLessThan(layoutCloseIndex);
    });
});
