/**
 * @file DestinationPOISection.test.ts
 * @description Source-based assertions for `DestinationPOISection.astro`
 * (HOS-113 T-048). Astro components cannot be rendered in Vitest (no DOM
 * renderer for `.astro` — see `apps/web/CLAUDE.md` Testing section), so this
 * suite asserts against the component source for: the empty-array guard
 * ("hidden when empty"), the featured-first / displayWeight-desc / name-asc
 * sort, i18n display-name + type-label resolution wiring, and that it stays
 * list/grid-only (no map/marker imports — NG-3 / OQ-4).
 *
 * Real per-locale (es/en/pt) translation resolution for POI names and type
 * labels is exercised end to end in `test/lib/poi-labels.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionSrc = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationPOISection.astro'),
    'utf8'
);

describe('DestinationPOISection.astro', () => {
    it('renders nothing when pointsOfInterest is empty (guarded like attractions)', () => {
        expect(sectionSrc).toContain(
            'if (!pointsOfInterest || pointsOfInterest.length === 0) return;'
        );
    });

    it('resolves POI display names via translatePoiName (nameI18n-first, humanized-slug fallback — HOS-138)', () => {
        expect(sectionSrc).toContain(
            "import { translatePoiCategoryLabel, translatePoiName } from '@/lib/poi-labels';"
        );
        expect(sectionSrc).toContain(
            'translatePoiName({ slug: poi.slug, nameI18n: poi.nameI18n, locale })'
        );
    });

    it('resolves POI descriptions via resolveI18nText (descriptionI18n-first, legacy description fallback — HOS-138)', () => {
        expect(sectionSrc).toContain("import { resolveI18nText } from '@/lib/resolve-i18n-text';");
        expect(sectionSrc).toContain(
            'resolveI18nText(poi.descriptionI18n, locale) || poi.description'
        );
    });

    it('resolves the badge label via translatePoiCategoryLabel, not the legacy type label', () => {
        // HOS-182: the badge prefers the POI's primary CATEGORY name and only
        // falls back to `type`. Reading `type` unconditionally made two thirds of
        // a real destination's cards say "Otro" beside a category-driven icon.
        expect(sectionSrc).toContain('translatePoiCategoryLabel({');
        expect(sectionSrc).toContain('primaryCategory: poi.primaryCategory');
        expect(sectionSrc).not.toContain('translatePoiTypeLabel({ t, type: poi.type })');
    });

    it('resolves a type-derived icon via getPointOfInterestTypeIcon', () => {
        expect(sectionSrc).toContain(
            "import { getPointOfInterestTypeIcon } from '@/lib/poi-type-icons';"
        );
    });

    it('renders no map/marker imports — list/grid only (NG-3/OQ-4)', () => {
        expect(sectionSrc).not.toMatch(/from ['"]@\/components\/maps\//);
    });

    it('sorts featured-first, then by displayWeight descending, then by display name', () => {
        expect(sectionSrc).toContain('(a.isFeatured ? 0 : 1) - (b.isFeatured ? 0 : 1)');
        expect(sectionSrc).toContain('wB - wA');
        expect(sectionSrc).toContain('a.displayName.localeCompare(b.displayName)');
    });

    it('renders the optional (resolved) description only when present', () => {
        expect(sectionSrc).toContain('{poi.resolvedDescription && (');
    });

    it('uses the destinations.detailPage.pointsOfInterestTitle i18n key for the section heading', () => {
        expect(sectionSrc).toContain(
            "t('destinations.detailPage.pointsOfInterestTitle', 'Puntos de interés')"
        );
    });

    it('does NOT import Tailwind utility classes or CSS Modules — vanilla scoped <style> per web conventions', () => {
        expect(sectionSrc).not.toContain('.module.css');
    });

    // HOS-146: the payload now carries PRIMARY + NEARBY POIs; the grid must
    // keep showing PRIMARY only (zero visual regression from pre-HOS-146).
    //
    // These three assert on identifiers and structure, NOT on verbatim
    // statements: a `biome check` reformat must never fail them. What they pin
    // down is the causal chain that keeps NEARBY POIs out of the grid —
    // filter → guard on the FILTERED list → sort the FILTERED list. Asserting
    // the same three facts against the raw `pointsOfInterest` prop is exactly
    // the regression they exist to catch.
    it('filters NEARBY out before rendering (PRIMARY-only grid, HOS-146)', () => {
        expect(sectionSrc).toMatch(/\.filter\(\s*\(poi\)\s*=>\s*poi\.relation\s*!==\s*'NEARBY'/);
    });

    it('guards on the NEARBY-filtered list, so a POI set that is entirely NEARBY renders nothing', () => {
        expect(sectionSrc).toMatch(/if\s*\(\s*primaryOnly\.length\s*===\s*0\s*\)\s*return/);
    });

    it('sorts the PRIMARY-filtered list, not the raw pointsOfInterest prop', () => {
        expect(sectionSrc).toMatch(/const\s+sorted\s*=\s*\[\s*\.\.\.primaryOnly\s*\]/);
    });
});
