/**
 * @file WhatsNearbySection.test.ts
 * @description Tests for `WhatsNearbySection.astro` (HOS-145 T-010, extended
 * by HOS-327).
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer for
 * `.astro` in this repo — see `apps/web/CLAUDE.md` Testing section: "Astro
 * components | Read source file, assert on content (no DOM renderer in
 * Vitest)"; `experimental_AstroContainer` fails to transform these files, as
 * `PartnerMentionsSection.test.ts` already documents). This suite therefore
 * combines:
 *
 *  1. Source-based assertions on the component (empty guard, the ABSENCE of a
 *     re-sort, the `hasOwnPage` link gate, the `descriptionI18n` preference,
 *     i18n wiring, distance formatting wiring, and that every design token it
 *     names actually exists) — the same pattern used by
 *     `test/components/destination/DestinationPOISection.test.ts`.
 *  2. Full behavioral coverage of the pure logic the component composes
 *     (order preservation, name/type-label resolution with humanized-slug
 *     fallback, multilang description resolution, URL building, distance
 *     formatting) via the underlying helpers directly, which IS unit-testable
 *     without a DOM — this exercises the exact same code paths the component's
 *     frontmatter calls.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NearbyPoi } from '@repo/schemas';
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { formatDistanceKm } from '../../../src/lib/format-distance';
import { createTranslations } from '../../../src/lib/i18n';
import { translatePoiName, translatePoiTypeLabel } from '../../../src/lib/poi-labels';
import { resolveI18nText } from '../../../src/lib/resolve-i18n-text';
import { buildUrl } from '../../../src/lib/urls';

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
        hasOwnPage: false,
        address: null,
        ...overrides
    } as NearbyPoi;
}

describe('WhatsNearbySection.astro (source-based)', () => {
    it('renders nothing when pointsOfInterest is empty (mirrors DestinationPOISection convention)', () => {
        expect(sectionSrc).toContain(
            'if (!pointsOfInterest || pointsOfInterest.length === 0) return;'
        );
    });

    it('HOS-327: does NOT re-order — the API order is a relevance ranking', () => {
        // Before HOS-327 the component re-sorted by ascending distance
        // "defensively". The API now ranks by relevance (editorial weight
        // decayed by distance), so any reordering here silently restores the
        // exact distance-only ordering HOS-327 removed.
        //
        // The first version of this guard only banned `.sort(`, and a reviewer
        // walked straight past it with `.toSorted(...)` — same regression, 20
        // green tests. So the ban covers the whole family.
        //
        // KNOWN LIMITATION, stated rather than papered over: this reads the
        // component source, so a reordering performed inside an imported
        // helper (`@/lib/...`) is invisible to it. The guard catches the
        // plausible accident, not a determined author.
        const REORDERING_CALL = /\.(sort|toSorted|reverse|toReversed)\s*\(/;

        expect(sectionSrc).not.toMatch(REORDERING_CALL);
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

    it('HOS-327: prefers descriptionI18n over the legacy plain description', () => {
        expect(sectionSrc).toContain("import { resolveI18nText } from '@/lib/resolve-i18n-text';");
        expect(sectionSrc).toContain(
            'resolveI18nText(poi.descriptionI18n, locale) || poi.description'
        );
        expect(sectionSrc).toContain('{poi.resolvedDescription && (');
        // The raw legacy field must no longer be rendered on its own.
        expect(sectionSrc).not.toContain('{poi.description && (');
    });

    it('HOS-327: links a POI that has its own page, gated on hasOwnPage', () => {
        expect(sectionSrc).toContain("import { buildUrl } from '@/lib/urls';");
        // Same route and same gate as DestinationPOISection — /destinos/lugar/
        // 404s for every catalog row that lacks the flag.
        expect(sectionSrc).toContain('poi.hasOwnPage ? (');
        expect(sectionSrc).toContain('buildUrl({ locale, path: `destinos/lugar/${poi.slug}` })');
    });

    it('HOS-327: builds the POI page URL exactly like DestinationPOISection does', () => {
        // A divergence here is a 404 neither `astro check` nor `tsc` can see.
        const destinationSectionSrc = readFileSync(
            resolve(__dirname, '../../../src/components/destination/DestinationPOISection.astro'),
            'utf8'
        );
        const hrefPattern = 'buildUrl({ locale, path: `destinos/lugar/${poi.slug}` })';
        expect(destinationSectionSrc).toContain(hrefPattern);
        expect(sectionSrc).toContain(hrefPattern);
    });

    it('HOS-327: only uses design tokens that exist (a missing one silently ignores the theme)', () => {
        // `var(--does-not-exist, #ccc)` paints a plausible grey and drops the
        // theme, so every token this component names is checked against the
        // generated token artifact rather than eyeballed.
        const tokenCss = readFileSync(
            resolve(
                __dirname,
                '../../../../../packages/design-tokens/src/generators/__snapshots__/generate-css.test.ts.snap'
            ),
            'utf8'
        );
        const used = [...sectionSrc.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
        expect(used.length).toBeGreaterThan(0);
        for (const token of new Set(used)) {
            expect(tokenCss, `${token} is not a defined design token`).toContain(`${token}:`);
        }
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
    // NOTE: order preservation is NOT asserted here. Any such test would have
    // to build its own array and map over it, asserting `Array.prototype.map`
    // rather than anything this component does — it could not fail. The
    // component's order is pinned by the source-level "does NOT re-order"
    // guard above, and the ordering itself is covered end-to-end by
    // `service-core/.../getNearbyRanked.test.ts` and by the API integration
    // suite against a real database.

    it('HOS-327: resolves the description multilang-first, degrading to the plain field', () => {
        const withI18n = buildPoi({
            distanceKm: 1,
            description: 'Legacy plain description.',
            descriptionI18n: { es: 'Descripción en español', en: 'English description', pt: null }
        });
        const onlyPlain = buildPoi({
            distanceKm: 1,
            description: 'Legacy plain description.',
            descriptionI18n: null
        });
        const neither = buildPoi({ distanceKm: 1, description: null, descriptionI18n: null });

        const resolve_ = (poi: NearbyPoi, locale: string) =>
            resolveI18nText(poi.descriptionI18n, locale) || poi.description;

        expect(resolve_(withI18n, 'es')).toBe('Descripción en español');
        expect(resolve_(withI18n, 'en')).toBe('English description');
        // `pt` is null on this row: resolveI18nText falls back through es/en
        // rather than degrading to the legacy field.
        expect(resolve_(withI18n, 'pt')).toBe('Descripción en español');
        expect(resolve_(onlyPlain, 'es')).toBe('Legacy plain description.');
        // Neither present: falsy, so the component renders no description at
        // all instead of an empty paragraph.
        expect(resolve_(neither, 'es')).toBeFalsy();
    });

    it('HOS-327: builds the POI detail URL the route actually serves', () => {
        // `/{lang}/destinos/lugar/{slug}/` — the page at
        // src/pages/[lang]/destinos/lugar/[slug]/index.astro. The trailing
        // slash is buildUrl's, and it matters: the route is a directory index.
        expect(buildUrl({ locale: 'es', path: 'destinos/lugar/palacio-san-jose' })).toBe(
            '/es/destinos/lugar/palacio-san-jose/'
        );
        expect(buildUrl({ locale: 'en', path: 'destinos/lugar/palacio-san-jose' })).toBe(
            '/en/destinos/lugar/palacio-san-jose/'
        );
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
