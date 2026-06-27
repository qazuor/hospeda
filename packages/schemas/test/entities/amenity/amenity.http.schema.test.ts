/**
 * Tests for amenity HTTP schema converter functions.
 *
 * Verifies:
 * - AmenitySearchHttpSchema coerces string query params to typed fields
 * - httpToDomainAmenitySearch maps to domain search input
 * - httpToDomainAmenityCreate sets required domain defaults
 * - httpToDomainAmenityUpdate maps isActive inversely to isBuiltin
 */
import { describe, expect, it } from 'vitest';
import {
    AmenitySearchHttpSchema,
    httpToDomainAmenityCreate,
    httpToDomainAmenitySearch,
    httpToDomainAmenityUpdate
} from '../../../src/entities/amenity/amenity.http.schema.js';
import { AmenitiesTypeEnum } from '../../../src/enums/index.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseCreatePayload = {
    applicableVerticals: ['accommodation'] as ('accommodation' | 'gastronomy' | 'experience')[],
    type: AmenitiesTypeEnum.OUTDOORS,
    priority: 50,
    isActive: true,
    isPopular: false,
    isFeatured: false,
    displayWeight: 50
};

// ---------------------------------------------------------------------------
// AmenitySearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('AmenitySearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = AmenitySearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept type enum filter', () => {
        const result = AmenitySearchHttpSchema.safeParse({
            type: AmenitiesTypeEnum.CONNECTIVITY
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe(AmenitiesTypeEnum.CONNECTIVITY);
        }
    });

    it('should coerce isActive from string "true" to boolean', () => {
        const result = AmenitySearchHttpSchema.safeParse({ isActive: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isActive).toBe(true);
        }
    });

    it('should coerce isFeatured from string "false" to boolean', () => {
        const result = AmenitySearchHttpSchema.safeParse({ isFeatured: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(false);
        }
    });

    it('should coerce minPriority and maxPriority from strings to numbers', () => {
        const result = AmenitySearchHttpSchema.safeParse({ minPriority: '5', maxPriority: '95' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minPriority).toBe(5);
            expect(result.data.maxPriority).toBe(95);
        }
    });

    it('should reject invalid type enum value', () => {
        const result = AmenitySearchHttpSchema.safeParse({ type: 'INVALID_TYPE' });
        expect(result.success).toBe(false);
    });

    it('should accept descriptionContains text filter', () => {
        const result = AmenitySearchHttpSchema.safeParse({ descriptionContains: 'pool' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.descriptionContains).toBe('pool');
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAmenitySearch
// ---------------------------------------------------------------------------

describe('httpToDomainAmenitySearch', () => {
    it('should map pagination and sort fields to domain search', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({ page: '2', pageSize: '15' });

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(15);
    });

    it('should include slug filter in domain output', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({ slug: 'wifi' });

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.slug).toBe('wifi');
    });

    it('should include type filter in domain output', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({ type: AmenitiesTypeEnum.KITCHEN });

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.type).toBe(AmenitiesTypeEnum.KITCHEN);
    });

    it('should include hasIcon and hasDescription in domain output', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({ hasIcon: 'true', hasDescription: 'false' });

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.hasIcon).toBe(true);
        expect(result.hasDescription).toBe(false);
    });

    it('should include date range filters in domain output', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({
            createdAfter: '2024-01-01',
            createdBefore: '2024-12-31'
        });

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdBefore).toBeInstanceOf(Date);
    });

    it('should handle empty input with all-undefined domain fields', () => {
        // Arrange
        const parsed = AmenitySearchHttpSchema.parse({});

        // Act
        const result = httpToDomainAmenitySearch(parsed);

        // Assert
        expect(result.slug).toBeUndefined();
        expect(result.type).toBeUndefined();
        expect(result.hasIcon).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAmenityCreate
// ---------------------------------------------------------------------------

describe('httpToDomainAmenityCreate', () => {
    it('should map applicableVerticals and type to domain create input', () => {
        // Act
        const result = httpToDomainAmenityCreate(baseCreatePayload);

        // Assert
        expect(result.applicableVerticals).toEqual(['accommodation']);
        expect(result.type).toBe(AmenitiesTypeEnum.OUTDOORS);
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        // Act
        const result = httpToDomainAmenityCreate(baseCreatePayload);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should set isBuiltin to false for user-created amenities', () => {
        // Act
        const result = httpToDomainAmenityCreate(baseCreatePayload);

        // Assert
        expect(result.isBuiltin).toBe(false);
    });

    it('should pass isFeatured from HTTP data', () => {
        // Arrange
        const payload = { ...baseCreatePayload, isFeatured: true };

        // Act
        const result = httpToDomainAmenityCreate(payload);

        // Assert
        expect(result.isFeatured).toBe(true);
    });

    it('should pass displayWeight from HTTP data', () => {
        // Arrange
        const payload = { ...baseCreatePayload, displayWeight: 80 };

        // Act
        const result = httpToDomainAmenityCreate(payload);

        // Assert
        expect(result.displayWeight).toBe(80);
    });

    it('should pass optional icon when provided', () => {
        // Arrange
        const payload = { ...baseCreatePayload, icon: 'pool-icon' };

        // Act
        const result = httpToDomainAmenityCreate(payload);

        // Assert
        expect(result.icon).toBe('pool-icon');
    });

    it('should pass optional slug when provided', () => {
        // Arrange
        const payload = { ...baseCreatePayload, slug: 'heated-pool' };

        // Act
        const result = httpToDomainAmenityCreate(payload);

        // Assert
        expect(result.slug).toBe('heated-pool');
    });
});

// ---------------------------------------------------------------------------
// httpToDomainAmenityUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainAmenityUpdate', () => {
    it('should map applicableVerticals update to domain update input', () => {
        // Arrange
        const httpData = {
            applicableVerticals: ['accommodation', 'gastronomy'] as (
                | 'accommodation'
                | 'gastronomy'
                | 'experience'
            )[]
        };

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.applicableVerticals).toEqual(['accommodation', 'gastronomy']);
    });

    it('should map isActive=true to isBuiltin=false (inverse mapping)', () => {
        // Arrange
        const httpData = { isActive: true };

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.isBuiltin).toBe(false);
    });

    it('should map isActive=false to isBuiltin=true (inverse mapping)', () => {
        // Arrange
        const httpData = { isActive: false };

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.isBuiltin).toBe(true);
    });

    it('should set isBuiltin to undefined when isActive is not provided', () => {
        // Arrange
        const httpData = { type: AmenitiesTypeEnum.SAFETY };

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.isBuiltin).toBeUndefined();
    });

    it('should pass type through when provided', () => {
        // Arrange
        const httpData = { type: AmenitiesTypeEnum.ACCESSIBILITY };

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.type).toBe(AmenitiesTypeEnum.ACCESSIBILITY);
    });

    it('should handle empty update payload', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainAmenityUpdate(httpData);

        // Assert
        expect(result.slug).toBeUndefined();
        expect(result.type).toBeUndefined();
        expect(result.isBuiltin).toBeUndefined();
    });
});
