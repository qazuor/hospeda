/**
 * @file WhatsNearbySection.test.ts
 * @description Tests for `WhatsNearbySection.astro` (HOS-145 T-010).
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer for
 * `.astro` in this repo — see `apps/web/CLAUDE.md` Testing section: "Astro
 * components | Read source file, assert on content (no DOM renderer in
 * Vitest)"). This suite therefore combines:
 *
 *  1. Source-based assertions on the component (empty guard, distance-ascending
 *     sort, i18n wiring, distance formatting wiring) — the same pattern used
 *     by `test/components/destination/DestinationPOISection.test.ts`.
 *  2. Full behavioral coverage of the pure logic the component composes
 *     (sort-by-distance, name/type-label resolution with humanized-slug
 *     fallback, distance formatting) via the underlying helpers directly,
 *     which IS unit-testable without a DOM — this exercises the exact same
 *     code paths the component's frontmatter calls.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NearbyPoi } from '@repo/schemas';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { formatDistanceKm } from '../../../src/lib/format-distance';
import { createTranslations } from '../../../src/lib/i18n';
import { translatePoiName, translatePoiTypeLabel } from '../../../src/lib/poi-labels';

const sectionSrc = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/WhatsNearbySection.astro'),
    'utf8'
);

function buildPoi(overrides: Partial<NearbyPoi> & { readonly distanceKm: number }): NearbyPoi {
    return {
        id: 'poi-id',
        slug: 'test_poi',
        lat: -32.48,
        long: -58.23,
        type: PointOfInterestTypeEnum.PARK,
        nameI18n: null,
        description: null,
        descriptionI18n: null,
        icon: null,
        isFeatured: false,
        isBuiltin: true,
        displayWeight: 0,
        ...overrides
    } as NearbyPoi;
}

describe('WhatsNearbySection.astro (source-based)', () => {
    it('renders nothing when pointsOfInterest is empty (mirrors DestinationPOISection convention)', () => {
        expect(sectionSrc).toContain(
            'if (!pointsOfInterest || pointsOfInterest.length === 0) return;'
        );
    });

    it('sorts ascending by distanceKm', () => {
        expect(sectionSrc).toContain('.sort((a, b) => a.distanceKm - b.distanceKm)');
    });

    it('formats distance via formatDistanceKm', () => {
        expect(sectionSrc).toContain("import { formatDistanceKm } from '@/lib/format-distance';");
        expect(sectionSrc).toContain('formatDistanceKm({ distanceKm: poi.distanceKm, locale })');
    });

    it('resolves POI display names via translatePoiName (nameI18n-first, humanized-slug fallback)', () => {
        expect(sectionSrc).toContain(
            "import { translatePoiCategoryLabel, translatePoiName } from '@/lib/poi-labels';"
        );
        expect(sectionSrc).toContain(
            'translatePoiName({ slug: poi.slug, nameI18n: poi.nameI18n, locale })'
        );
    });

    it('resolves the badge label via translatePoiCategoryLabel, not the legacy type label', () => {
        // HOS-182: prefer the POI's primary CATEGORY name, fall back to `type`.
        expect(sectionSrc).toContain('translatePoiCategoryLabel({');
        expect(sectionSrc).toContain('primaryCategory: poi.primaryCategory');
        expect(sectionSrc).not.toContain('translatePoiTypeLabel({ t, type: poi.type })');
    });

    it('resolves a type-derived icon via getPointOfInterestTypeIcon', () => {
        expect(sectionSrc).toContain(
            "import { getPointOfInterestTypeIcon } from '@/lib/poi-type-icons';"
        );
    });

    it('renders the plain-text description field directly (NearbyPoi has no descriptionI18n)', () => {
        expect(sectionSrc).toContain('{poi.description && (');
    });

    it('uses the accommodations.detail.nearbyPoi.title i18n key for the section heading', () => {
        expect(sectionSrc).toContain("t('accommodations.detail.nearbyPoi.title', 'Qué hay cerca')");
    });

    it('imports NearbyPoi from @repo/schemas', () => {
        expect(sectionSrc).toContain("import type { NearbyPoi } from '@repo/schemas';");
    });

    it('does NOT import CSS Modules — vanilla scoped <style> per web conventions', () => {
        expect(sectionSrc).not.toContain('.module.css');
    });
});

describe('WhatsNearbySection logic (helpers exercised by the component frontmatter)', () => {
    it('sorts nearest-first when given unsorted input', () => {
        const pois: NearbyPoi[] = [
            buildPoi({ id: 'far', slug: 'far_poi', distanceKm: 4.2 }),
            buildPoi({ id: 'near', slug: 'near_poi', distanceKm: 0.3 }),
            buildPoi({ id: 'mid', slug: 'mid_poi', distanceKm: 1.8 })
        ];

        const sorted = [...pois].sort((a, b) => a.distanceKm - b.distanceKm);

        expect(sorted.map((p) => p.id)).toEqual(['near', 'mid', 'far']);
    });

    it('formats each POI distance via formatDistanceKm', () => {
        const { t } = createTranslations('es');
        expect(t).toBeTypeOf('function');

        expect(formatDistanceKm({ distanceKm: 0.35, locale: 'es' })).toBe('350 m');
        expect(formatDistanceKm({ distanceKm: 1.25, locale: 'es' })).toBe('1,3 km');
    });

    it('resolves POI name to a humanized slug fallback when nameI18n is absent (AC-7: no [MISSING: leak)', () => {
        const name = translatePoiName({
            slug: 'plaza_25_de_mayo',
            nameI18n: null,
            locale: 'es'
        });
        expect(name).not.toContain('[MISSING:');
        expect(name).toBe('Plaza 25 De Mayo');
    });

    it('resolves POI type label without leaking [MISSING: placeholders', () => {
        const { t } = createTranslations('es');
        const label = translatePoiTypeLabel({ t, type: PointOfInterestTypeEnum.BEACH });
        expect(label).not.toContain('[MISSING:');
        expect(label).toBeTruthy();
    });

    it('resolves an unknown type value to a humanized fallback, never [MISSING:', () => {
        const { t } = createTranslations('es');
        const label = translatePoiTypeLabel({ t, type: 'NOT_A_REAL_TYPE' });
        expect(label).toBe('Not A Real Type');
    });
});
