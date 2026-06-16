/**
 * Tests for attraction HTTP schema converter functions.
 *
 * Verifies:
 * - AttractionSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainAttractionSearch maps to domain search input
 * - httpToDomainAttractionCreate sets lifecycleState to ACTIVE
 * - httpToDomainAttractionUpdate passes only provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    AttractionSearchHttpSchema,
    httpToDomainAttractionCreate,
    httpToDomainAttractionSearch,
    httpToDomainAttractionUpdate
} from '../../../src/entities/attraction/attraction.http.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const DESTINATION_UUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

// ---------------------------------------------------------------------------
// AttractionSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('AttractionSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = AttractionSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept name and description filters', () => {
        const result = AttractionSearchHttpSchema.safeParse({
            name: 'Thermal baths',
            description: 'hot springs'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('Thermal baths');
            expect(result.data.description).toBe('hot springs');
        }
    });

    it('should coerce isFeatured from string "true" to boolean', () => {
        const result = AttractionSearchHttpSchema.safeParse({ isFeatured: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(true);
        }
    });

    it('should coerce isBuiltin from string "false" to boolean', () => {
        const result = AttractionSearchHttpSchema.safeParse({ isBuiltin: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isBuiltin).toBe(false);
        }
    });

    it('should accept valid destinationId UUID', () => {
        const result = AttractionSearchHttpSchema.safeParse({ destinationId: DESTINATION_UUID });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinationId).toBe(DESTINATION_UUID);
        }
    });

    it('should reject invalid destinationId (non-UUID)', () => {
        const result = AttractionSearchHttpSchema.safeParse({ destinationId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should accept destinations and icons as comma-separated string filters', () => {
        const result = AttractionSearchHttpSchema.safeParse({
            destinations: DESTINATION_UUID,
            icons: 'map-pin,star'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destinations).toEqual([DESTINATION_UUID]);
            expect(result.data.icons).toEqual(['map-pin', 'star']);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAttractionSearch
// ---------------------------------------------------------------------------

describe('httpToDomainAttractionSearch', () => {
    it('should map pagination fields to domain search input', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({ page: '2', pageSize: '20' });

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(20);
    });

    it('should include name filter in domain output', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({ name: 'Beach' });

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.name).toBe('Beach');
    });

    it('should include isFeatured boolean in domain output', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({ isFeatured: 'true' });

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.isFeatured).toBe(true);
    });

    it('should include isBuiltin boolean in domain output', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({ isBuiltin: 'false' });

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.isBuiltin).toBe(false);
    });

    it('should include destinationId in domain output', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({ destinationId: DESTINATION_UUID });

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.destinationId).toBe(DESTINATION_UUID);
    });

    it('should handle empty input with all-undefined domain fields', () => {
        // Arrange
        const parsed = AttractionSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainAttractionSearch(parsed);

        // Assert
        expect(result.name).toBeUndefined();
        expect(result.isFeatured).toBeUndefined();
        expect(result.destinationId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAttractionCreate
// ---------------------------------------------------------------------------

describe('httpToDomainAttractionCreate', () => {
    it('should map required fields to domain create input', () => {
        // Arrange
        const httpData = {
            name: 'Hot Springs',
            description: 'Natural thermal water pools with healing properties',
            icon: 'hot-spring',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainAttractionCreate(httpData);

        // Assert
        expect(result.name).toBe('Hot Springs');
        expect(result.description).toBe('Natural thermal water pools with healing properties');
        expect(result.icon).toBe('hot-spring');
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        // Arrange
        const httpData = {
            name: 'Beach Walk',
            description: 'A scenic beach walk along the coast near town',
            icon: 'beach',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainAttractionCreate(httpData);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should pass isFeatured through when true', () => {
        // Arrange
        const httpData = {
            name: 'City Museum',
            description: 'Main historical museum in the city center area',
            icon: 'museum',
            isFeatured: true,
            isBuiltin: false,
            displayWeight: 80
        };

        // Act
        const result = httpToDomainAttractionCreate(httpData);

        // Assert
        expect(result.isFeatured).toBe(true);
        expect(result.displayWeight).toBe(80);
    });

    it('should pass optional slug when provided', () => {
        // Arrange
        const httpData = {
            name: 'River Port',
            slug: 'river-port',
            description: 'Historic river port with scenic views and ferries',
            icon: 'port',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 60
        };

        // Act
        const result = httpToDomainAttractionCreate(httpData);

        // Assert
        expect(result.slug).toBe('river-port');
    });

    it('should pass optional destinationId when provided', () => {
        // Arrange
        const httpData = {
            name: 'National Park',
            description: 'Large national park with diverse flora and fauna',
            icon: 'park',
            destinationId: DESTINATION_UUID,
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 70
        };

        // Act
        const result = httpToDomainAttractionCreate(httpData);

        // Assert
        expect(result.destinationId).toBe(DESTINATION_UUID);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAttractionUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainAttractionUpdate', () => {
    it('should map name update to domain update input', () => {
        // Arrange
        const httpData = { name: 'Updated Attraction' };

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.name).toBe('Updated Attraction');
    });

    it('should map description update', () => {
        // Arrange
        const httpData = { description: 'Updated description for the attraction' };

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.description).toBe('Updated description for the attraction');
    });

    it('should map icon update', () => {
        // Arrange
        const httpData = { icon: 'new-icon' };

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.icon).toBe('new-icon');
    });

    it('should map isFeatured update', () => {
        // Arrange
        const httpData = { isFeatured: true };

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.isFeatured).toBe(true);
    });

    it('should map displayWeight update', () => {
        // Arrange
        const httpData = { displayWeight: 90 };

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.displayWeight).toBe(90);
    });

    it('should handle empty update payload', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainAttractionUpdate(httpData);

        // Assert
        expect(result.name).toBeUndefined();
        expect(result.description).toBeUndefined();
        expect(result.icon).toBeUndefined();
        expect(result.isFeatured).toBeUndefined();
        expect(result.displayWeight).toBeUndefined();
    });
});
