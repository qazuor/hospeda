/**
 * @file LocationSection.test.ts
 * @description Source tests of the shared location block (HOS-2579 §6.5):
 * `listing/location/LocationSection.astro`. Vitest cannot render `.astro`
 * here; the gates live in `build-location-section.ts` and are unit tested in
 * `test/lib/listing-location/build-location-section.test.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../../src');
const read = (file: string): string => readFileSync(resolve(SRC, file), 'utf8');
const section = read('components/listing/location/LocationSection.astro');
const markup = section.split('\n---\n').slice(1).join('\n---\n');

describe('LocationSection.astro', () => {
    it('draws the approximate circle client-only and the exact pin on visible', () => {
        const exactAt = markup.indexOf("{map?.mode === 'exact'");
        const approximate = markup.slice(markup.indexOf("{map?.mode === 'approximate'"), exactAt);
        const exact = markup.slice(exactAt, markup.indexOf('{externalMapHref'));
        expect(approximate).toContain('mode="approximate"');
        expect(exact).toContain('mode="exact"');
        expect(exact).not.toContain('client:only');
        expect(approximate).toContain('client:only="react"');
        expect(approximate).toContain('radiusMeters={map.radiusMeters}');
        expect(exact).toContain('client:visible');
        expect(exact).toContain('zoom={map.zoom}');
        expect(markup).not.toContain('mode="multi"');
    });

    it('draws no map when the builder returns map: null', () => {
        expect(markup).toContain("{map?.mode === 'approximate' && (");
        expect(markup).toContain("{map?.mode === 'exact' && (");
    });

    it('keeps the card-radius tile shape for every map', () => {
        expect(section).toContain('--location-map-tile-radius: var(--radius-card);');
    });

    it('opens the external map in a new tab with the tracking data attributes', () => {
        const link = markup.match(/<a\s+class="location-section__external"[\s\S]*?>/)?.[0] ?? '';
        expect(link).toContain('href={externalMapHref}');
        expect(link).toContain('rel="noopener noreferrer"');
        expect(link).toContain('{...linkData}');
    });

    it('uses LocationIcon and ArrowRightIcon instead of the 📍 emoji and the CSS arrow', () => {
        expect(section).toContain("import { ArrowRightIcon, LocationIcon } from '@repo/icons';");
        expect(markup).toContain('<ArrowRightIcon size={16} aria-hidden="true" />');
        expect(section).not.toContain('📍');
        expect(section).not.toMatch(/content:\s*'→'/);
    });

    it('links the destination when its href is known and shows plain text otherwise', () => {
        expect(markup).toContain('<a href={destination.href} class="location-section__link">');
        expect(markup).toContain('<span class="location-section__city">{destination.name}</span>');
    });

    it('carries the section anchor id from the builder', () => {
        expect(markup).toContain('<section class="location-section" id={id}>');
    });
});

describe('the three pages use the shared location block (HOS-2579 §6.5)', () => {
    it.each([
        ['pages/[lang]/alojamientos/[slug].astro', 'buildAccommodationLocation'],
        ['pages/[lang]/comer-y-salir/[slug].astro', 'buildVenueLocation'],
        ['pages/[lang]/experiencias/[slug].astro', 'buildExperienceLocation']
    ])('%s builds it with %s', (page, builder) => {
        const src = read(page);
        expect(src).toContain(
            "import LocationSection from '@/components/listing/location/LocationSection.astro'"
        );
        expect(src).toContain(`${builder}({`);
    });

    it('deleted the per-vertical location components', () => {
        for (const file of [
            'components/accommodation/LocationSection.astro',
            'components/venue/VenueAddress.astro',
            'components/experience/ExperienceMeetingPoint.astro'
        ]) {
            expect(existsSync(resolve(SRC, file))).toBe(false);
        }
    });
});
