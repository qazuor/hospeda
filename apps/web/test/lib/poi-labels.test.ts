/**
 * @file poi-labels.test.ts
 * @description Unit tests for the destination POI i18n label resolvers
 * (HOS-113 T-050). Verifies `translatePoiTypeLabel` resolves all 9
 * `PointOfInterestTypeEnum` values across es/en/pt, `translatePoiName`
 * resolves a seeded slug, and both fall back safely on a missing key.
 */

import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';
import { translatePoiName, translatePoiTypeLabel } from '../../src/lib/poi-labels';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];
const POI_TYPES = Object.values(PointOfInterestTypeEnum);

describe('translatePoiTypeLabel', () => {
    it.each(LOCALES)('resolves all 9 PointOfInterestTypeEnum values for locale "%s"', (locale) => {
        const { t } = createTranslations(locale);
        expect(POI_TYPES).toHaveLength(9);
        for (const type of POI_TYPES) {
            const label = translatePoiTypeLabel({ t, type });
            expect(label).toBeTruthy();
            expect(label.startsWith('[MISSING:')).toBe(false);
        }
    });

    it('falls back to a humanized value when the type label is missing', () => {
        const { t } = createTranslations('es');
        const label = translatePoiTypeLabel({ t, type: 'NOT_A_REAL_TYPE' });
        expect(label).toBe('Not A Real Type');
    });
});

describe('translatePoiName', () => {
    it.each(LOCALES)('resolves a seeded POI slug for locale "%s"', (locale) => {
        const { t } = createTranslations(locale);
        const name = translatePoiName({ t, slug: 'autodromo_concepcion_del_uruguay' });
        expect(name).toBeTruthy();
        expect(name.startsWith('[MISSING:')).toBe(false);
    });

    it('falls back to a humanized slug when no translation exists', () => {
        const { t } = createTranslations('es');
        const name = translatePoiName({ t, slug: 'unknown_poi_slug' });
        expect(name).toBe('Unknown Poi Slug');
    });
});
