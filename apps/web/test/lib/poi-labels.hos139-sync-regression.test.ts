/**
 * @file poi-labels.hos139-sync-regression.test.ts
 * @description HOS-139 AC-8c regression coverage: `points_of_interest.type`
 * is now WRITTEN by `PointOfInterestCategoryService`'s primary-category sync
 * (`deriveTypeFromCategorySlug`, `CATEGORY_SLUG_TO_POI_TYPE` in
 * `@repo/schemas`, spec §6.5/§7.6) instead of being hand-picked at seed time.
 * NG-1 requires every existing `type`-keyed consumer to keep working
 * UNCHANGED given that synced value — `poi-labels.ts` itself received no
 * HOS-139 code changes (the pre-existing `test/lib/poi-labels.test.ts`
 * already proves it resolves all 9 static `PointOfInterestTypeEnum` values).
 *
 * This suite proves the "unchanged in code, still works" half of AC-8c from
 * the OTHER direction: instead of iterating the static enum, it feeds
 * `translatePoiTypeLabel` every value the sync's OWN derivation function can
 * actually produce (the 9 direct-mapping slugs plus representative
 * non-mapped slugs that derive to the `OTHER` catch-all, spec §7.6), so a
 * future change to the mapping table that accidentally derives an
 * enum-invalid string would be caught here even if the static enum-iteration
 * test in `poi-labels.test.ts` still passed.
 *
 * The search-filter consumer (`PointOfInterestService.buildSearchWhere`'s
 * `type` branch staying a plain column filter alongside the additive
 * `categoryId`/`categorySlug` join filter) and the
 * `DestinationPOISection.astro` badge's wiring to `translatePoiTypeLabel`
 * are already covered by
 * `packages/service-core/test/services/point-of-interest/point-of-interest.service.test.ts`
 * ("type branch unchanged") and
 * `apps/web/test/components/destination/DestinationPOISection.test.ts`
 * respectively — not duplicated here.
 */

import {
    CATEGORY_SLUG_TO_POI_TYPE,
    deriveTypeFromCategorySlug,
    PointOfInterestTypeEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';
import { translatePoiTypeLabel } from '../../src/lib/poi-labels';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

/** The 9 category slugs with a direct legacy-type equivalent (spec §7.6). */
const DIRECT_MAPPING_SLUGS = Object.keys(CATEGORY_SLUG_TO_POI_TYPE);

/**
 * A representative sample of category slugs with NO direct mapping — spec
 * §7.6's catch-all: every one of these must derive to `OTHER`. Includes a
 * deliberately made-up slug to prove the derivation is total (never throws,
 * never crashes on an unknown/future category — spec §7.6's closing note).
 */
const OTHER_DERIVING_SLUGS = [
    'winery',
    'gastronomy',
    'religious_site',
    'historic_site',
    'art',
    'theater',
    'an-unknown-future-category-slug'
];

describe('HOS-139 AC-8c — points_of_interest.type consumer regression (poi-labels.ts)', () => {
    it('every direct-mapping category slug derives to a valid PointOfInterestTypeEnum value', () => {
        const enumValues = new Set<string>(Object.values(PointOfInterestTypeEnum));
        for (const slug of DIRECT_MAPPING_SLUGS) {
            const derived = deriveTypeFromCategorySlug(slug);
            expect(enumValues.has(derived)).toBe(true);
        }
    });

    it('every non-mapped/unknown category slug derives to OTHER (spec §7.6 catch-all, never throws)', () => {
        for (const slug of OTHER_DERIVING_SLUGS) {
            expect(() => deriveTypeFromCategorySlug(slug)).not.toThrow();
            expect(deriveTypeFromCategorySlug(slug)).toBe(PointOfInterestTypeEnum.OTHER);
        }
    });

    it('CATEGORY_SLUG_TO_POI_TYPE range is a subset of PointOfInterestTypeEnum (no sync write could ever violate the NOT NULL enum column)', () => {
        const enumValues = new Set<string>(Object.values(PointOfInterestTypeEnum));
        for (const type of Object.values(CATEGORY_SLUG_TO_POI_TYPE)) {
            expect(enumValues.has(type)).toBe(true);
        }
    });

    it.each(
        LOCALES
    )('translatePoiTypeLabel resolves a real (non-fallback-missing) label for EVERY type the sync can ever write, locale "%s"', (locale) => {
        const { t } = createTranslations(locale);

        // Every value `deriveTypeFromCategorySlug` can produce, across
        // both the direct-mapping slugs and the OTHER-catch-all sample —
        // this is the sync's actual write-domain, not just the static
        // enum list.
        const allDerivableTypes = new Set<string>([
            ...DIRECT_MAPPING_SLUGS.map((slug) => deriveTypeFromCategorySlug(slug)),
            ...OTHER_DERIVING_SLUGS.map((slug) => deriveTypeFromCategorySlug(slug))
        ]);

        // The derivation range is always within the 9 enum values.
        expect(allDerivableTypes.size).toBeLessThanOrEqual(9);

        for (const type of allDerivableTypes) {
            const label = translatePoiTypeLabel({ t, type });
            expect(label).toBeTruthy();
            expect(label.startsWith('[MISSING:')).toBe(false);
        }
    });
});
