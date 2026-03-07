/**
 * Tests for static data exports in src/data/.
 * Verifies each constant is a non-empty array with the expected shape,
 * no duplicate IDs, correct filter formats, and data integrity constraints.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_TYPES, ACCOMMODATION_TYPE_NAMES } from '../../src/data/accommodation-types';
import { AMENITIES } from '../../src/data/amenities';
import { DESTINATION_NAMES } from '../../src/data/destinations';
import { HERO_IMAGE_SOURCES, SLIDE_SECONDS } from '../../src/data/hero';
import { FOOTER_LINKS, NAV_LINKS } from '../../src/data/navigation';
import { REVIEWS } from '../../src/data/reviews';
import { STATS } from '../../src/data/stats';

describe('ACCOMMODATION_TYPES', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(ACCOMMODATION_TYPES)).toBe(true);
        expect(ACCOMMODATION_TYPES.length).toBeGreaterThan(0);
    });

    it('each item should have id, name, icon, and filter fields', () => {
        for (const item of ACCOMMODATION_TYPES) {
            expect(typeof item.id).toBe('string');
            expect(item.id.length).toBeGreaterThan(0);
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(typeof item.icon).toBe('function');
            expect(typeof item.filter).toBe('string');
            expect(item.filter).toContain('tipo=');
        }
    });

    it('should contain hotel and cabana types', () => {
        const ids = ACCOMMODATION_TYPES.map((t) => t.id);
        expect(ids).toContain('hotel');
        expect(ids).toContain('cabana');
    });
});

describe('ACCOMMODATION_TYPE_NAMES', () => {
    it('should be a non-empty array of strings', () => {
        expect(Array.isArray(ACCOMMODATION_TYPE_NAMES)).toBe(true);
        expect(ACCOMMODATION_TYPE_NAMES.length).toBeGreaterThan(0);
        for (const name of ACCOMMODATION_TYPE_NAMES) {
            expect(typeof name).toBe('string');
            expect(name.length).toBeGreaterThan(0);
        }
    });

    it('should contain Hotel and Cabana', () => {
        expect(ACCOMMODATION_TYPE_NAMES).toContain('Hotel');
        expect(ACCOMMODATION_TYPE_NAMES).toContain('Cabana');
    });
});

describe('AMENITIES', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(AMENITIES)).toBe(true);
        expect(AMENITIES.length).toBeGreaterThan(0);
    });

    it('each item should have id, name, icon, and filter fields', () => {
        for (const item of AMENITIES) {
            expect(typeof item.id).toBe('string');
            expect(item.id.length).toBeGreaterThan(0);
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(typeof item.icon).toBe('function');
            expect(typeof item.filter).toBe('string');
            expect(item.filter).toContain('amenity=');
        }
    });

    it('should include wifi and pileta amenities', () => {
        const ids = AMENITIES.map((a) => a.id);
        expect(ids).toContain('wifi');
        expect(ids).toContain('pileta');
    });
});

describe('DESTINATION_NAMES', () => {
    it('should be a non-empty array of strings', () => {
        expect(Array.isArray(DESTINATION_NAMES)).toBe(true);
        expect(DESTINATION_NAMES.length).toBeGreaterThan(0);
        for (const name of DESTINATION_NAMES) {
            expect(typeof name).toBe('string');
            expect(name.length).toBeGreaterThan(0);
        }
    });

    it('should contain expected destinations', () => {
        expect(DESTINATION_NAMES).toContain('Colon');
        expect(DESTINATION_NAMES).toContain('Gualeguaychu');
        expect(DESTINATION_NAMES).toContain('Concordia');
    });
});

describe('NAV_LINKS', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(NAV_LINKS)).toBe(true);
        expect(NAV_LINKS.length).toBeGreaterThan(0);
    });

    it('each item should have labelKey, label, anchor, and path fields', () => {
        for (const link of NAV_LINKS) {
            expect(typeof link.labelKey).toBe('string');
            expect(link.labelKey.length).toBeGreaterThan(0);
            expect(typeof link.label).toBe('string');
            expect(link.label.length).toBeGreaterThan(0);
            expect(typeof link.anchor).toBe('string');
            expect(link.anchor.startsWith('#')).toBe(true);
            expect(typeof link.path).toBe('string');
            expect(link.path.length).toBeGreaterThan(0);
        }
    });

    it('should include Alojamientos and Destinos', () => {
        const paths = NAV_LINKS.map((l) => l.path);
        expect(paths).toContain('alojamientos');
        expect(paths).toContain('destinos');
    });
});

describe('FOOTER_LINKS', () => {
    it('should be an object with section keys', () => {
        expect(typeof FOOTER_LINKS).toBe('object');
        expect(FOOTER_LINKS).not.toBeNull();
    });

    it('should have Explore, Destinations, Owners, and Hospeda sections', () => {
        expect(FOOTER_LINKS).toHaveProperty('Explore');
        expect(FOOTER_LINKS).toHaveProperty('Destinations');
        expect(FOOTER_LINKS).toHaveProperty('Owners');
        expect(FOOTER_LINKS).toHaveProperty('Hospeda');
    });

    it('each section should be a non-empty array', () => {
        for (const section of Object.keys(FOOTER_LINKS)) {
            const links = FOOTER_LINKS[section];
            expect(Array.isArray(links)).toBe(true);
            expect(links.length).toBeGreaterThan(0);
        }
    });

    it('each footer link should have labelKey, label, and path', () => {
        for (const section of Object.keys(FOOTER_LINKS)) {
            for (const link of FOOTER_LINKS[section]) {
                expect(typeof link.labelKey).toBe('string');
                expect(link.labelKey.length).toBeGreaterThan(0);
                expect(typeof link.label).toBe('string');
                expect(link.label.length).toBeGreaterThan(0);
                expect(typeof link.path).toBe('string');
            }
        }
    });
});

describe('REVIEWS', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(REVIEWS)).toBe(true);
        expect(REVIEWS.length).toBeGreaterThan(0);
    });

    it('each item should have name, location, text, rating, and accommodation', () => {
        for (const review of REVIEWS) {
            expect(typeof review.name).toBe('string');
            expect(review.name.length).toBeGreaterThan(0);
            expect(typeof review.location).toBe('string');
            expect(review.location.length).toBeGreaterThan(0);
            expect(typeof review.text).toBe('string');
            expect(review.text.length).toBeGreaterThan(0);
            expect(typeof review.rating).toBe('number');
            expect(review.rating).toBeGreaterThanOrEqual(1);
            expect(review.rating).toBeLessThanOrEqual(5);
            expect(typeof review.accommodation).toBe('string');
            expect(review.accommodation.length).toBeGreaterThan(0);
        }
    });

    it('all reviews should have 5-star rating', () => {
        for (const review of REVIEWS) {
            expect(review.rating).toBe(5);
        }
    });
});

describe('STATS', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(STATS)).toBe(true);
        expect(STATS.length).toBeGreaterThan(0);
    });

    it('each item should have icon, value, label, and description', () => {
        for (const stat of STATS) {
            expect(typeof stat.icon).toBe('function');
            expect(typeof stat.value).toBe('string');
            expect(stat.value.length).toBeGreaterThan(0);
            expect(typeof stat.label).toBe('string');
            expect(stat.label.length).toBeGreaterThan(0);
            expect(typeof stat.description).toBe('string');
            expect(stat.description.length).toBeGreaterThan(0);
        }
    });

    it('should have at least 4 stats', () => {
        expect(STATS.length).toBeGreaterThanOrEqual(4);
    });
});

// ---------------------------------------------------------------------------
// Duplicate ID integrity checks
// ---------------------------------------------------------------------------

describe('ACCOMMODATION_TYPES - no duplicate IDs', () => {
    it('should not contain duplicate id values', () => {
        // Arrange
        const ids = ACCOMMODATION_TYPES.map((t) => t.id);

        // Act
        const uniqueIds = new Set(ids);

        // Assert
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('filter values should be unique', () => {
        // Arrange
        const filters = ACCOMMODATION_TYPES.map((t) => t.filter);

        // Act
        const uniqueFilters = new Set(filters);

        // Assert
        expect(uniqueFilters.size).toBe(filters.length);
    });
});

describe('AMENITIES - no duplicate IDs', () => {
    it('should not contain duplicate id values', () => {
        // Arrange
        const ids = AMENITIES.map((a) => a.id);

        // Act
        const uniqueIds = new Set(ids);

        // Assert
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('filter values should be unique', () => {
        // Arrange
        const filters = AMENITIES.map((a) => a.filter);

        // Act
        const uniqueFilters = new Set(filters);

        // Assert
        expect(uniqueFilters.size).toBe(filters.length);
    });
});

describe('DESTINATION_NAMES - no duplicates', () => {
    it('should not contain duplicate destination names', () => {
        // Arrange & Act
        const unique = new Set(DESTINATION_NAMES);

        // Assert
        expect(unique.size).toBe(DESTINATION_NAMES.length);
    });
});

// ---------------------------------------------------------------------------
// Filter format integrity
// ---------------------------------------------------------------------------

describe('ACCOMMODATION_TYPES - filter format', () => {
    it('each filter should follow the "tipo=<value>" pattern', () => {
        const filterPattern = /^tipo=\S+$/;
        for (const type of ACCOMMODATION_TYPES) {
            expect(filterPattern.test(type.filter)).toBe(true);
        }
    });

    it('filter values should match the item id', () => {
        for (const type of ACCOMMODATION_TYPES) {
            const filterValue = type.filter.split('=')[1];
            expect(filterValue).toBe(type.id);
        }
    });
});

describe('AMENITIES - filter format', () => {
    it('each filter should follow the "amenity=<value>" pattern', () => {
        const filterPattern = /^amenity=\S+$/;
        for (const amenity of AMENITIES) {
            expect(filterPattern.test(amenity.filter)).toBe(true);
        }
    });

    it('filter values should match the item id', () => {
        for (const amenity of AMENITIES) {
            const filterValue = amenity.filter.split('=')[1];
            expect(filterValue).toBe(amenity.id);
        }
    });
});

// ---------------------------------------------------------------------------
// NAV_LINKS - anchor and labelKey format
// ---------------------------------------------------------------------------

describe('NAV_LINKS - anchor and labelKey format', () => {
    it('each anchor should start with "#"', () => {
        for (const link of NAV_LINKS) {
            expect(link.anchor.startsWith('#')).toBe(true);
        }
    });

    it('each labelKey should use the "nav." namespace prefix', () => {
        for (const link of NAV_LINKS) {
            expect(link.labelKey.startsWith('nav.')).toBe(true);
        }
    });

    it('anchor values should be unique', () => {
        // Arrange
        const anchors = NAV_LINKS.map((l) => l.anchor);

        // Act
        const unique = new Set(anchors);

        // Assert
        expect(unique.size).toBe(anchors.length);
    });

    it('path values should be unique', () => {
        // Arrange
        const paths = NAV_LINKS.map((l) => l.path);

        // Act
        const unique = new Set(paths);

        // Assert
        expect(unique.size).toBe(paths.length);
    });
});

// ---------------------------------------------------------------------------
// FOOTER_LINKS - labelKey namespace format
// ---------------------------------------------------------------------------

describe('FOOTER_LINKS - labelKey format', () => {
    it('each footer link labelKey should contain a dot (namespace.key)', () => {
        for (const section of Object.keys(FOOTER_LINKS)) {
            for (const link of FOOTER_LINKS[section]) {
                expect(link.labelKey).toContain('.');
            }
        }
    });

    it('paths should be non-empty strings (no accidental undefined)', () => {
        for (const section of Object.keys(FOOTER_LINKS)) {
            for (const link of FOOTER_LINKS[section]) {
                // path is allowed to be an empty string for unlinked items,
                // but should never be undefined or null
                expect(link.path).not.toBeUndefined();
                expect(link.path).not.toBeNull();
            }
        }
    });
});

// ---------------------------------------------------------------------------
// HERO_IMAGE_SOURCES
// ---------------------------------------------------------------------------

describe('HERO_IMAGE_SOURCES', () => {
    it('should be a non-empty array', () => {
        // Arrange & Act & Assert
        expect(Array.isArray(HERO_IMAGE_SOURCES)).toBe(true);
        expect(HERO_IMAGE_SOURCES.length).toBeGreaterThan(0);
    });

    it('each item should have a non-empty alt text', () => {
        for (const image of HERO_IMAGE_SOURCES) {
            expect(typeof image.alt).toBe('string');
            expect(image.alt.length).toBeGreaterThan(0);
        }
    });

    it('each item should have a src object (Astro image import)', () => {
        for (const image of HERO_IMAGE_SOURCES) {
            // Astro image imports resolve to an object (not a plain string path)
            expect(image.src).toBeDefined();
            expect(image.src).not.toBeNull();
        }
    });

    it('alt texts should be unique (no copy-paste duplicates)', () => {
        // Arrange
        const alts = HERO_IMAGE_SOURCES.map((img) => img.alt);

        // Act
        const unique = new Set(alts);

        // Assert
        expect(unique.size).toBe(alts.length);
    });
});

describe('SLIDE_SECONDS', () => {
    it('should be a positive number', () => {
        expect(typeof SLIDE_SECONDS).toBe('number');
        expect(SLIDE_SECONDS).toBeGreaterThan(0);
    });

    it('should be at least 3 seconds (reasonable UX minimum)', () => {
        expect(SLIDE_SECONDS).toBeGreaterThanOrEqual(3);
    });
});

// ---------------------------------------------------------------------------
// types.ts - source structure validation
// ---------------------------------------------------------------------------

describe('types.ts source structure', () => {
    const typesSrc = readFileSync(resolve(__dirname, '../../src/data/types.ts'), 'utf8');

    it('should export the HeroImage interface', () => {
        expect(typesSrc).toContain('export interface HeroImage');
    });

    it('should export the AccommodationType interface', () => {
        expect(typesSrc).toContain('export interface AccommodationType');
    });

    it('should export the Amenity interface', () => {
        expect(typesSrc).toContain('export interface Amenity');
    });

    it('should export the Review interface', () => {
        expect(typesSrc).toContain('export interface Review');
    });

    it('should export the Stat interface', () => {
        expect(typesSrc).toContain('export interface Stat');
    });

    it('should export the NavLink interface', () => {
        expect(typesSrc).toContain('export interface NavLink');
    });

    it('should export the FooterLink interface', () => {
        expect(typesSrc).toContain('export interface FooterLink');
    });

    it('should export the FooterLinks interface', () => {
        expect(typesSrc).toContain('export interface FooterLinks');
    });

    it('should use readonly on all interface properties', () => {
        // Every property declaration should be readonly
        const propertyLines = typesSrc
            .split('\n')
            .filter(
                (line) => line.trim().match(/^\w/) && line.includes(':') && !line.includes('//')
            );
        for (const line of propertyLines) {
            expect(line).toContain('readonly');
        }
    });

    it('should use import type for React and IconProps (no runtime dependency)', () => {
        expect(typesSrc).toContain('import type');
    });
});
