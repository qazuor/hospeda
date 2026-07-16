/**
 * @file poi-labels.test.ts
 * @description Unit tests for the destination POI i18n label resolvers
 * (HOS-113 T-050, extended HOS-138 T-008 + legacy-key cleanup). Verifies
 * `translatePoiTypeLabel` resolves all 9 `PointOfInterestTypeEnum` values
 * across es/en/pt, and `translatePoiName` resolves a POI's `nameI18n`
 * multilang content (the sole source since HOS-138 removed the legacy
 * `destinations.poiNames.<slug>` keys), degrading to a humanized slug when
 * `nameI18n` is absent.
 */

import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';
import {
    translatePoiCategoryLabel,
    translatePoiName,
    translatePoiTypeLabel
} from '../../src/lib/poi-labels';

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
    it('resolves nameI18n content for the active locale (HOS-138)', () => {
        const name = translatePoiName({
            slug: 'autodromo_concepcion_del_uruguay',
            nameI18n: { es: 'Nombre ES', en: 'Name EN', pt: 'Nome PT' },
            locale: 'en'
        });
        expect(name).toBe('Name EN');
    });

    it.each(LOCALES)('resolves the right locale from nameI18n for "%s"', (locale) => {
        const nameI18n = { es: 'Autódromo', en: 'Racetrack', pt: 'Autódromo PT' };
        const name = translatePoiName({ slug: 'autodromo', nameI18n, locale });
        expect(name).toBe(nameI18n[locale]);
    });

    it('degrades to a humanized slug when nameI18n is null (deploy-window safety)', () => {
        const name = translatePoiName({
            slug: 'autodromo_concepcion_del_uruguay',
            nameI18n: null,
            locale: 'es'
        });
        expect(name).toBe('Autodromo Concepcion Del Uruguay');
    });

    it('degrades to a humanized slug when nameI18n is omitted entirely', () => {
        const name = translatePoiName({ slug: 'unknown_poi_slug' });
        expect(name).toBe('Unknown Poi Slug');
    });

    it('degrades to a humanized slug when the resolved locale value is empty', () => {
        const name = translatePoiName({
            slug: 'palacio_san_jose',
            nameI18n: { es: '', en: '', pt: '' },
            locale: 'es'
        });
        expect(name).toBe('Palacio San Jose');
    });
});

describe('translatePoiCategoryLabel (HOS-182)', () => {
    const { t } = createTranslations('es' as SupportedLocale);

    it('prefers the primary category name over the legacy type label', () => {
        // The whole point: on a real destination, 66 of 100 POIs are type=OTHER
        // with a real category, so reading `type` rendered "Otro" next to a
        // category-driven icon.
        const label = translatePoiCategoryLabel({
            t,
            type: PointOfInterestTypeEnum.OTHER,
            primaryCategory: { nameI18n: { es: 'Bodega', en: 'Winery', pt: 'Vinícola' } },
            locale: 'es'
        });
        expect(label).toBe('Bodega');
    });

    it('resolves the category name in the active locale', () => {
        const label = translatePoiCategoryLabel({
            t,
            type: PointOfInterestTypeEnum.OTHER,
            primaryCategory: { nameI18n: { es: 'Bodega', en: 'Winery', pt: 'Vinícola' } },
            locale: 'en'
        });
        expect(label).toBe('Winery');
    });

    it.each([
        ['null', null],
        ['undefined', undefined]
    ])('falls back to the type label when primaryCategory is %s', (_label, primaryCategory) => {
        const label = translatePoiCategoryLabel({
            t,
            type: PointOfInterestTypeEnum.BEACH,
            primaryCategory,
            locale: 'es'
        });
        expect(label).toBe(translatePoiTypeLabel({ t, type: PointOfInterestTypeEnum.BEACH }));
    });

    it('falls back to the type label when the category name resolves empty', () => {
        const label = translatePoiCategoryLabel({
            t,
            type: PointOfInterestTypeEnum.MUSEUM,
            primaryCategory: { nameI18n: { es: '', en: '', pt: '' } },
            locale: 'es'
        });
        expect(label).toBe(translatePoiTypeLabel({ t, type: PointOfInterestTypeEnum.MUSEUM }));
    });

    it('falls back to the type label when no locale is available to resolve with', () => {
        const label = translatePoiCategoryLabel({
            t,
            type: PointOfInterestTypeEnum.PARK,
            primaryCategory: { nameI18n: { es: 'Parque', en: 'Park', pt: 'Parque' } }
        });
        expect(label).toBe(translatePoiTypeLabel({ t, type: PointOfInterestTypeEnum.PARK }));
    });
});
