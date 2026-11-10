/**
 * @file experiencias-index-catalog-filters.test.ts
 * @description Source-read wiring test for the amenity/feature filters on the
 * experiences listing (HOS-2085). Astro pages cannot be rendered in Vitest, so
 * we assert on source structure, as the venue listing test does.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasActiveExperienceListingFilters } from '@/lib/listing-empty-state-filters';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/experiencias/index.astro'),
    'utf8'
);

describe('experiencias/index.astro catalog filters', () => {
    it('reads amenities and features from the URL and forwards them to the list call', () => {
        expect(src).toContain("url.searchParams.get('amenities')");
        expect(src).toContain("url.searchParams.get('features')");
        expect(src).toContain('amenities: amenitiesParam');
        expect(src).toContain('features: featuresParam');
    });

    it('scopes both catalogs to the experience vertical', () => {
        expect(src).toContain("applicableVertical: 'experience'");
        expect(src).toContain('amenitiesApi.list');
        expect(src).toContain('featuresApi.list');
    });

    it('narrows the catalogs through the options endpoint and builds the groups', () => {
        expect(src).toContain('experiencesApi.getFilterOptions()');
        expect(src).toContain('narrowExperienceCatalog');
        expect(src).toContain('buildExperienceCatalogFilterGroups');
    });

    it('marks the response degraded when a catalog read fails', () => {
        expect(src).toContain('VenueFilterOptionsDegradation');
        expect(src).toContain('!filterOptionsResult.ok');
    });

    it('stays session-blind: no session, user or cookie read in the frontmatter', () => {
        expect(src).not.toMatch(/Astro\.locals\.(session|user)/);
        expect(src).not.toContain('Astro.cookies');
    });
});

describe('hasActiveExperienceListingFilters with catalog filters', () => {
    const base = {
        q: undefined,
        destinationId: undefined,
        type: undefined,
        isFeatured: undefined,
        minRating: undefined
    };

    it('is false with none', () => {
        expect(hasActiveExperienceListingFilters(base)).toBe(false);
    });

    it('is true when amenities or features are selected', () => {
        expect(hasActiveExperienceListingFilters({ ...base, amenities: 'a,b' })).toBe(true);
        expect(hasActiveExperienceListingFilters({ ...base, features: 'a' })).toBe(true);
    });
});
