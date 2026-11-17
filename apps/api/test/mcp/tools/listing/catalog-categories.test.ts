/**
 * HOS-2327 AC-C12 — every amenity `type` and feature `category` has a Spanish
 * label in `@repo/i18n`, and the wizard order covers both enums exactly.
 *
 * @module test/mcp/tools/listing/catalog-categories
 */

import { AmenitiesTypeEnum, FeatureCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ALL_CATALOG_CATEGORIES,
    AMENITY_CATEGORIES,
    categoriesOf,
    categoryLabel,
    categoryLabelKey,
    FEATURE_CATEGORIES
} from '../../../../src/mcp/tools/listing/catalog-categories';
import { translateCatalogKey } from '../../../../src/services/ai-context/listing-labels';

describe('catalog categories', () => {
    it.each(
        Object.values(AmenitiesTypeEnum)
    )('has an es i18n label for the amenity type %s (AC-C12)', (type) => {
        // Act
        const { label } = translateCatalogKey({
            key: categoryLabelKey({ kind: 'amenity', category: type }),
            locale: 'es'
        });

        // Assert
        expect(label).not.toBeNull();
    });

    it.each(
        Object.values(FeatureCategoryEnum)
    )('has an es i18n label for the feature category %s (AC-C12)', (category) => {
        // Act
        const { label } = translateCatalogKey({
            key: categoryLabelKey({ kind: 'feature', category }),
            locale: 'es'
        });

        // Assert
        expect(label).not.toBeNull();
    });

    it('resolves multi-word values through their camelCase key', () => {
        expect(categoryLabel({ kind: 'amenity', category: 'BED_AND_BATH' })).toBe(
            'Dormitorio y baño'
        );
        expect(categoryLabel({ kind: 'feature', category: 'OFFER_PROFILE' })).toBe(
            'Perfil de la oferta'
        );
    });

    it('degrades to a humanized code, never the raw value, when a key is missing', () => {
        expect(categoryLabel({ kind: 'amenity', category: 'NEW_THING' })).toBe('New thing');
    });

    it('walks every enum value exactly once, the amenity catch-all last', () => {
        expect([...AMENITY_CATEGORIES].sort()).toEqual(Object.values(AmenitiesTypeEnum).sort());
        expect([...FEATURE_CATEGORIES].sort()).toEqual(Object.values(FeatureCategoryEnum).sort());
        expect(AMENITY_CATEGORIES.at(-1)).toBe(AmenitiesTypeEnum.GENERAL_APPLIANCES);
        expect(categoriesOf({ kind: 'amenity' })).toBe(AMENITY_CATEGORIES);
        expect(categoriesOf({ kind: 'feature' })).toBe(FEATURE_CATEGORIES);
    });

    it('shares no value between the two enums, so a category names its kind', () => {
        expect(new Set(ALL_CATALOG_CATEGORIES).size).toBe(ALL_CATALOG_CATEGORIES.length);
    });
});
