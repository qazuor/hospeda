/**
 * @file VenueAddress.map.source.test.ts
 * @description Owner smoke (HOS-2520 item 17): the venue page shows its map inline,
 * with the same LocationMap and tile shape as the accommodation location section,
 * and keeps the «Ver en el mapa» link to a full map.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';

const read = (relative: string): string =>
    readFileSync(resolve(__dirname, '../../../src', relative), 'utf8');

const ADDRESS = read('components/venue/VenueAddress.astro');
const LOCATION_SECTION = read('components/accommodation/LocationSection.astro');
const PAGE = read('pages/[lang]/comer-y-salir/[slug].astro');

describe('VenueAddress inline map', () => {
    it('renders the shared LocationMap with the exact pin, only when coordinates exist', () => {
        expect(ADDRESS).toContain(
            "import { LocationMap } from '@/components/maps/LocationMap.client';"
        );
        expect(ADDRESS).toMatch(
            /\{coordinates && \(\s*<div class="venue-address__map-frame">\s*<LocationMap/
        );
        expect(ADDRESS).toMatch(/<LocationMap[^>]*mode="exact"/);
        expect(ADDRESS).toMatch(
            /<LocationMap[^>]*lat=\{coordinates\.lat\}[^>]*lng=\{coordinates\.lng\}/
        );
        expect(ADDRESS).toMatch(/<LocationMap[^>]*ariaLabel=\{t\('maps\.ariaLabelVenue'\)\}/);
    });

    it('uses the accommodation tile shape', () => {
        for (const src of [ADDRESS, LOCATION_SECTION]) {
            expect(src).toContain('--location-map-tile-radius: var(--radius-card);');
            expect(src).toContain('--location-map-tile-overflow: hidden;');
        }
    });

    it('keeps the full-map link next to it', () => {
        expect(ADDRESS).toMatch(/\{mapUrl && \(\s*<a\s+class="venue-address__map"/);
    });

    it('gets the venue name for the marker from the page', () => {
        expect(PAGE).toMatch(/Component: VenueAddress,[\s\S]{0,200}venueName: venue\.name/);
    });

    it.each([
        ['es', 'Mapa con la ubicación del local'],
        ['en', 'Map with the venue location'],
        ['pt', 'Mapa com a localização do estabelecimento']
    ] as const)('localizes the map name in %s', (locale, expected) => {
        expect(createTranslations(locale).t('maps.ariaLabelVenue')).toBe(expected);
    });
});
