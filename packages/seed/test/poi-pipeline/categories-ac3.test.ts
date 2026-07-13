import { describe, expect, it } from 'vitest';
import { loadRealCategorySlugs } from '../../scripts/poi-pipeline/categories.js';

/**
 * HOS-141 T-014 / AC-3. The 40 distinct UPPER_SNAKE `categorySlugs` values
 * observed in the source CSV (spec §5). Every one must lowercase into a real
 * seeded HOS-139 poi_category slug — proving the pipeline can never emit a
 * category outside the curated catalog. Hard-coded (not read from the external
 * CSV) so this runs in CI.
 */
const CSV_CATEGORY_VALUES = [
    'HISTORIC_SITE',
    'RECREATION',
    'TOURIST_ROUTE',
    'NATURAL_AREA',
    'EDUCATION',
    'CULTURAL_CENTER',
    'SERVICES',
    'PARK',
    'WATERFRONT',
    'SPORTS_VENUE',
    'ARCHITECTURE',
    'COMMUNITY_CENTER',
    'FAMILY',
    'MONUMENT',
    'ENTERTAINMENT',
    'INDUSTRIAL_HERITAGE',
    'MUSEUM',
    'FAIR',
    'TRANSPORT',
    'BIRDWATCHING',
    'GASTRONOMY',
    'SQUARE',
    'RELIGIOUS_SITE',
    'BEACH',
    'HIKING',
    'GOVERNMENT',
    'VIEWPOINT',
    'ART',
    'SHOPPING',
    'RESERVE',
    'CAMPGROUND',
    'HEALTH',
    'PORT',
    'THEATER',
    'NIGHTLIFE',
    'THERMAL_COMPLEX',
    'WELLNESS',
    'WINERY',
    'CASINO',
    'OTHER'
] as const;

describe('AC-3: category-map right-hand side ⊆ HOS-139 seeded catalog', () => {
    it('covers exactly 40 distinct source values', () => {
        expect(new Set(CSV_CATEGORY_VALUES).size).toBe(40);
    });

    it('every CSV category lowercases into a real seeded poi_category slug', () => {
        // Arrange
        const realSlugs = loadRealCategorySlugs();

        // Act
        const missing = CSV_CATEGORY_VALUES.filter((value) => !realSlugs.has(value.toLowerCase()));

        // Assert
        expect(missing).toEqual([]);
    });
});
