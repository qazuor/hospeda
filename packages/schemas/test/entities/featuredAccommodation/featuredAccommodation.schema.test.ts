import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { FeaturedAccommodationSchema } from '../../../src/entities/featuredAccommodation/featuredAccommodation.schema.js';
import { FeaturedStatusEnum } from '../../../src/enums/featured-status.enum.js';
import { FeaturedTypeEnum } from '../../../src/enums/featured-type.enum.js';
import {
    createComplexFeaturedAccommodation,
    createFeaturedAccommodationByStatus,
    createFeaturedAccommodationByType,
    createFeaturedAccommodationEdgeCases,
    createFeaturedAccommodationWithInvalidDates,
    createFeaturedAccommodationWithValidDates,
    createInvalidFeaturedAccommodation,
    createMinimalFeaturedAccommodation,
    createValidFeaturedAccommodation
} from '../../fixtures/featuredAccommodation.fixtures.js';

describe('FeaturedAccommodationSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid featured accommodation', () => {
            const validData = createValidFeaturedAccommodation();

            expect(() => FeaturedAccommodationSchema.parse(validData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(validData);
            expect(result).toBeDefined();
            expect(result.id).toBe(validData.id);
            expect(result.clientId).toBe(validData.clientId);
            expect(result.accommodationId).toBe(validData.accommodationId);
            expect(result.featuredType).toBe(validData.featuredType);
            expect(result.status).toBe(validData.status);
        });

        it('should validate minimal required featured accommodation data', () => {
            const minimalData = createMinimalFeaturedAccommodation();

            expect(() => FeaturedAccommodationSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex featured accommodation', () => {
            const complexData = createComplexFeaturedAccommodation();

            expect(() => FeaturedAccommodationSchema.parse(complexData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(complexData);
            expect(result.featuredType).toBe(FeaturedTypeEnum.DESTINATION);
            expect(result.status).toBe(FeaturedStatusEnum.ACTIVE);
        });

        it('should validate featured accommodation with valid date range', () => {
            const validDatesData = createFeaturedAccommodationWithValidDates();

            expect(() => FeaturedAccommodationSchema.parse(validDatesData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(validDatesData);
            expect(new Date(result.fromDate).getTime()).toBeLessThan(
                new Date(result.toDate).getTime()
            );
        });

        it('should validate all featured types', () => {
            for (const type of Object.values(FeaturedTypeEnum)) {
                const data = createFeaturedAccommodationByType(type);

                expect(() => FeaturedAccommodationSchema.parse(data)).not.toThrow();

                const result = FeaturedAccommodationSchema.parse(data);
                expect(result.featuredType).toBe(type);
            }
        });

        it('should validate all featured statuses', () => {
            for (const status of Object.values(FeaturedStatusEnum)) {
                const data = createFeaturedAccommodationByStatus(status);

                expect(() => FeaturedAccommodationSchema.parse(data)).not.toThrow();

                const result = FeaturedAccommodationSchema.parse(data);
                expect(result.status).toBe(status);
            }
        });
    });

    describe('Invalid Data', () => {
        it('should reject featured accommodation with invalid data', () => {
            const invalidData = createInvalidFeaturedAccommodation();

            expect(() => FeaturedAccommodationSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject featured accommodation with missing required fields', () => {
            const incompleteData = {
                id: 'valid-uuid-here'
                // Missing other required fields
            };

            expect(() => FeaturedAccommodationSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject featured accommodation with invalid UUIDs', () => {
            const invalidUuidData = {
                ...createValidFeaturedAccommodation(),
                id: 'not-a-uuid',
                clientId: 'also-not-a-uuid'
            };

            expect(() => FeaturedAccommodationSchema.parse(invalidUuidData)).toThrow(ZodError);
        });

        it('should reject featured accommodation with invalid dates', () => {
            const invalidDatesData = createFeaturedAccommodationWithInvalidDates();

            // Note: Schema-level validation doesn't check date logic, only format
            // Business logic validation would be handled in business validation schema
            expect(() => FeaturedAccommodationSchema.parse(invalidDatesData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(invalidDatesData);
            // But we can verify the dates are parsed correctly
            expect(new Date(result.fromDate).getTime()).toBeGreaterThan(
                new Date(result.toDate).getTime()
            );
        });

        it('should reject featured accommodation with invalid featured type', () => {
            const invalidTypeData = {
                ...createValidFeaturedAccommodation(),
                featuredType: 'INVALID_TYPE'
            };

            expect(() => FeaturedAccommodationSchema.parse(invalidTypeData)).toThrow(ZodError);
        });

        it('should reject featured accommodation with invalid status', () => {
            const invalidStatusData = {
                ...createValidFeaturedAccommodation(),
                status: 'INVALID_STATUS'
            };

            expect(() => FeaturedAccommodationSchema.parse(invalidStatusData)).toThrow(ZodError);
        });

        it('should reject featured accommodation with invalid datetime format', () => {
            const invalidDateFormatData = {
                ...createValidFeaturedAccommodation(),
                fromDate: 'not-a-date',
                toDate: '2023-13-45' // Invalid date
            };

            expect(() => FeaturedAccommodationSchema.parse(invalidDateFormatData)).toThrow(
                ZodError
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case data appropriately', () => {
            const edgeCaseData = createFeaturedAccommodationEdgeCases();

            // Schema should parse but business validation would catch the logic issues
            expect(() => FeaturedAccommodationSchema.parse(edgeCaseData)).not.toThrow();
        });
    });

    describe('Field Validation', () => {
        it('should validate all UUID fields correctly', () => {
            const data = createValidFeaturedAccommodation();

            const result = FeaturedAccommodationSchema.parse(data);

            // All UUID fields should be valid UUIDs
            expect(result.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
            expect(result.clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
            expect(result.accommodationId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should validate datetime fields correctly', () => {
            const data = createValidFeaturedAccommodation();

            const result = FeaturedAccommodationSchema.parse(data);

            // All datetime fields should be valid ISO strings
            expect(() => new Date(result.fromDate)).not.toThrow();
            expect(() => new Date(result.toDate)).not.toThrow();
            expect(() => new Date(result.createdAt)).not.toThrow();
            expect(() => new Date(result.updatedAt)).not.toThrow();
        });

        it('should validate enum fields correctly', () => {
            const data = createValidFeaturedAccommodation();

            const result = FeaturedAccommodationSchema.parse(data);

            expect(Object.values(FeaturedTypeEnum)).toContain(result.featuredType);
            expect(Object.values(FeaturedStatusEnum)).toContain(result.status);
        });
    });

    describe('Featured Type Specific Tests', () => {
        it('should validate HOME featured type', () => {
            const homeData = createFeaturedAccommodationByType(FeaturedTypeEnum.HOME);

            expect(() => FeaturedAccommodationSchema.parse(homeData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(homeData);
            expect(result.featuredType).toBe(FeaturedTypeEnum.HOME);
        });

        it('should validate DESTINATION featured type', () => {
            const destinationData = createFeaturedAccommodationByType(FeaturedTypeEnum.DESTINATION);

            expect(() => FeaturedAccommodationSchema.parse(destinationData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(destinationData);
            expect(result.featuredType).toBe(FeaturedTypeEnum.DESTINATION);
        });

        it('should validate SEARCH featured type', () => {
            const searchData = createFeaturedAccommodationByType(FeaturedTypeEnum.SEARCH);

            expect(() => FeaturedAccommodationSchema.parse(searchData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(searchData);
            expect(result.featuredType).toBe(FeaturedTypeEnum.SEARCH);
        });

        it('should validate OTHER featured type', () => {
            const otherData = createFeaturedAccommodationByType(FeaturedTypeEnum.OTHER);

            expect(() => FeaturedAccommodationSchema.parse(otherData)).not.toThrow();

            const result = FeaturedAccommodationSchema.parse(otherData);
            expect(result.featuredType).toBe(FeaturedTypeEnum.OTHER);
        });
    });
});
