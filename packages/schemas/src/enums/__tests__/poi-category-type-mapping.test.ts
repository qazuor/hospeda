import { describe, expect, it } from 'vitest';
import {
    CATEGORY_SLUG_TO_POI_TYPE,
    deriveTypeFromCategorySlug,
    POI_TYPE_TO_CATEGORY_SLUG
} from '../poi-category-type-mapping.js';
import { PointOfInterestTypeEnum } from '../point-of-interest-type.enum.js';

// ============================================================================
// POI_TYPE_TO_CATEGORY_SLUG (spec §7.4 — forward mapping)
// ============================================================================

describe('POI_TYPE_TO_CATEGORY_SLUG', () => {
    it('should map all 9 legacy PointOfInterestTypeEnum values to a category slug', () => {
        const values = Object.values(PointOfInterestTypeEnum);
        expect(values).toHaveLength(9);
        for (const type of values) {
            expect(POI_TYPE_TO_CATEGORY_SLUG[type]).toBeTypeOf('string');
        }
    });

    it('should match the exact 9 rows documented in spec §7.4', () => {
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.BEACH]).toBe('beach');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.STADIUM]).toBe('sports_venue');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.PARK]).toBe('park');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.MUSEUM]).toBe('museum');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.PLAZA]).toBe('square');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.MONUMENT]).toBe('monument');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.VIEWPOINT]).toBe('viewpoint');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.NATURAL]).toBe('natural_area');
        expect(POI_TYPE_TO_CATEGORY_SLUG[PointOfInterestTypeEnum.OTHER]).toBe('other');
    });
});

// ============================================================================
// deriveTypeFromCategorySlug (spec §7.6 — reverse mapping, total function)
// ============================================================================

describe('deriveTypeFromCategorySlug', () => {
    it('should resolve all 9 known category slugs to their exact legacy type', () => {
        expect(deriveTypeFromCategorySlug('beach')).toBe(PointOfInterestTypeEnum.BEACH);
        expect(deriveTypeFromCategorySlug('sports_venue')).toBe(PointOfInterestTypeEnum.STADIUM);
        expect(deriveTypeFromCategorySlug('park')).toBe(PointOfInterestTypeEnum.PARK);
        expect(deriveTypeFromCategorySlug('museum')).toBe(PointOfInterestTypeEnum.MUSEUM);
        expect(deriveTypeFromCategorySlug('square')).toBe(PointOfInterestTypeEnum.PLAZA);
        expect(deriveTypeFromCategorySlug('monument')).toBe(PointOfInterestTypeEnum.MONUMENT);
        expect(deriveTypeFromCategorySlug('viewpoint')).toBe(PointOfInterestTypeEnum.VIEWPOINT);
        expect(deriveTypeFromCategorySlug('natural_area')).toBe(PointOfInterestTypeEnum.NATURAL);
        expect(deriveTypeFromCategorySlug('other')).toBe(PointOfInterestTypeEnum.OTHER);
    });

    it('should derive OTHER for categories with no direct enum equivalent', () => {
        expect(deriveTypeFromCategorySlug('winery')).toBe(PointOfInterestTypeEnum.OTHER);
        expect(deriveTypeFromCategorySlug('gastronomy')).toBe(PointOfInterestTypeEnum.OTHER);
        expect(deriveTypeFromCategorySlug('religious_site')).toBe(PointOfInterestTypeEnum.OTHER);
    });

    it('should derive OTHER for an unknown/future slug without throwing', () => {
        expect(() => deriveTypeFromCategorySlug('some-41st-category')).not.toThrow();
        expect(deriveTypeFromCategorySlug('some-41st-category')).toBe(
            PointOfInterestTypeEnum.OTHER
        );
    });

    it('should be a total function — every key of CATEGORY_SLUG_TO_POI_TYPE round-trips', () => {
        for (const [slug, type] of Object.entries(CATEGORY_SLUG_TO_POI_TYPE)) {
            expect(deriveTypeFromCategorySlug(slug)).toBe(type);
        }
    });
});
