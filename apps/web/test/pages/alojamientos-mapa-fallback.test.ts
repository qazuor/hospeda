/**
 * @file alojamientos-mapa-fallback.test.ts
 * @description Source-assertion tests for the MapPlaceholder hydration fallback
 * in the accommodations map page (SPEC-228 T-016).
 *
 * Covers:
 * - MapPlaceholder is imported in the page.
 * - MapPlaceholder is used as `slot="fallback"` inside AccommodationsListingMap.
 * - The AccommodationsListingMap island uses `client:only="react"`.
 *
 * Astro pages cannot be rendered in Vitest — we assert on source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/mapa.astro'),
    'utf8'
);

describe('alojamientos/mapa.astro — MapPlaceholder fallback (SPEC-228 T-016)', () => {
    describe('imports', () => {
        it('imports MapPlaceholder from @/components/MapPlaceholder.astro', () => {
            expect(src).toContain("import MapPlaceholder from '@/components/MapPlaceholder.astro'");
        });
    });

    describe('island directive', () => {
        it('AccommodationsListingMap uses client:only="react"', () => {
            expect(src).toContain('client:only="react"');
        });
    });

    describe('fallback slot', () => {
        it('renders MapPlaceholder with slot="fallback"', () => {
            expect(src).toContain('slot="fallback"');
        });

        it('MapPlaceholder is nested inside AccommodationsListingMap', () => {
            const islandStart = src.indexOf('<AccommodationsListingMap');
            const fallbackIdx = src.indexOf('slot="fallback"');
            const islandEnd = src.indexOf('</AccommodationsListingMap>');
            expect(islandStart).toBeGreaterThan(-1);
            expect(fallbackIdx).toBeGreaterThan(-1);
            expect(islandEnd).toBeGreaterThan(-1);
            // fallback slot must appear after the island opening tag and before its closing tag
            expect(fallbackIdx).toBeGreaterThan(islandStart);
            expect(fallbackIdx).toBeLessThan(islandEnd);
        });

        it('MapPlaceholder fallback has an address prop', () => {
            // The MapPlaceholder inside the fallback slot must receive an address
            const fallbackIdx = src.indexOf('slot="fallback"');
            const closingIdx = src.indexOf('</AccommodationsListingMap>');
            const fallbackSection = src.slice(fallbackIdx, closingIdx);
            expect(fallbackSection).toContain('address=');
        });

        it('MapPlaceholder fallback has a title prop', () => {
            const fallbackIdx = src.indexOf('slot="fallback"');
            const closingIdx = src.indexOf('</AccommodationsListingMap>');
            const fallbackSection = src.slice(fallbackIdx, closingIdx);
            expect(fallbackSection).toContain('title=');
        });
    });
});
