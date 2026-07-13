/**
 * @file poi-labels.test.ts
 * @description Unit tests for the destination POI i18n label resolvers
 * (HOS-113 T-050, extended HOS-138 T-008). Verifies `translatePoiTypeLabel`
 * resolves all 9 `PointOfInterestTypeEnum` values across es/en/pt,
 * `translatePoiName` resolves a seeded slug, prefers multilang `nameI18n`
 * content when present, falls back to the legacy i18n-by-slug lookup when
 * `nameI18n` is null, and both fall back safely on a missing key.
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

    it('prefers nameI18n content over the i18n-by-slug lookup when present (HOS-138)', () => {
        const { t } = createTranslations('en');
        const name = translatePoiName({
            t,
            slug: 'autodromo_concepcion_del_uruguay',
            nameI18n: { es: 'Nombre ES', en: 'Name EN', pt: 'Nome PT' },
            locale: 'en'
        });
        expect(name).toBe('Name EN');
    });

    it('falls back to the i18n-by-slug lookup when nameI18n is null (HOS-138)', () => {
        const { t } = createTranslations('es');
        const name = translatePoiName({
            t,
            slug: 'autodromo_concepcion_del_uruguay',
            nameI18n: null,
            locale: 'es'
        });
        expect(name).toBeTruthy();
        expect(name.startsWith('[MISSING:')).toBe(false);
        // Same result as the pre-existing (no nameI18n args) call shape.
        expect(name).toBe(translatePoiName({ t, slug: 'autodromo_concepcion_del_uruguay' }));
    });
});
