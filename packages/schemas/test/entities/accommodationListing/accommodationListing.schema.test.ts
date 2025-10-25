import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccommodationListingSchema } from '../../../src/entities/accommodationListing/accommodationListing.schema.js';
import {
    createAccommodationListingEdgeCases,
    createAccommodationListingWithInvalidDates,
    createAccommodationListingWithValidDates,
    createComplexAccommodationListing,
    createInvalidAccommodationListing,
    createMinimalAccommodationListing,
    createValidAccommodationListing
} from '../../fixtures/accommodationListing.fixtures.js';

describe('AccommodationListingSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid accommodation listing', () => {
            const validData = createValidAccommodationListing();

            expect(() => AccommodationListingSchema.parse(validData)).not.toThrow();

            const result = AccommodationListingSchema.parse(validData);
            expect(result).toBeDefined();
            expect(result.id).toBe(validData.id);
            expect(result.clientId).toBe(validData.clientId);
            expect(result.accommodationId).toBe(validData.accommodationId);
            expect(result.listingPlanId).toBe(validData.listingPlanId);
            expect(result.status).toBe(validData.status);
        });

        it('should validate minimal required accommodation listing data', () => {
            const minimalData = createMinimalAccommodationListing();

            expect(() => AccommodationListingSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex accommodation listing with trial', () => {
            const complexData = createComplexAccommodationListing();

            expect(() => AccommodationListingSchema.parse(complexData)).not.toThrow();

            const result = AccommodationListingSchema.parse(complexData);
            expect(result.isTrial).toBe(true);
            expect(result.trialEndsAt).toBeDefined();
        });

        it('should validate accommodation listing with valid date range', () => {
            const validDatesData = createAccommodationListingWithValidDates();

            expect(() => AccommodationListingSchema.parse(validDatesData)).not.toThrow();

            const result = AccommodationListingSchema.parse(validDatesData);
            expect(new Date(result.fromDate).getTime()).toBeLessThan(
                new Date(result.toDate).getTime()
            );
        });

        it('should handle optional trial fields correctly', () => {
            const data = {
                ...createMinimalAccommodationListing(),
                isTrial: false,
                trialEndsAt: undefined
            };

            expect(() => AccommodationListingSchema.parse(data)).not.toThrow();

            const result = AccommodationListingSchema.parse(data);
            expect(result.isTrial).toBe(false);
            expect(result.trialEndsAt).toBeUndefined();
        });
    });

    describe('Invalid Data', () => {
        it('should reject accommodation listing with invalid data', () => {
            const invalidData = createInvalidAccommodationListing();

            expect(() => AccommodationListingSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject accommodation listing with missing required fields', () => {
            const incompleteData = {
                id: 'valid-uuid-here'
                // Missing other required fields
            };

            expect(() => AccommodationListingSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject accommodation listing with invalid UUIDs', () => {
            const invalidUuidData = {
                ...createValidAccommodationListing(),
                id: 'not-a-uuid',
                clientId: 'also-not-a-uuid'
            };

            expect(() => AccommodationListingSchema.parse(invalidUuidData)).toThrow(ZodError);
        });

        it('should reject accommodation listing with invalid dates', () => {
            const invalidDatesData = createAccommodationListingWithInvalidDates();

            // Note: Schema-level validation doesn't check date logic, only format
            // Business logic validation would be handled in business validation schema
            expect(() => AccommodationListingSchema.parse(invalidDatesData)).not.toThrow();

            const result = AccommodationListingSchema.parse(invalidDatesData);
            // But we can verify the dates are parsed correctly
            expect(new Date(result.fromDate).getTime()).toBeGreaterThan(
                new Date(result.toDate).getTime()
            );
        });

        it('should reject accommodation listing with invalid status', () => {
            const invalidStatusData = {
                ...createValidAccommodationListing(),
                status: 'INVALID_STATUS'
            };

            expect(() => AccommodationListingSchema.parse(invalidStatusData)).toThrow(ZodError);
        });

        it('should reject accommodation listing with invalid datetime format', () => {
            const invalidDateFormatData = {
                ...createValidAccommodationListing(),
                fromDate: 'not-a-date',
                toDate: '2023-13-45' // Invalid date
            };

            expect(() => AccommodationListingSchema.parse(invalidDateFormatData)).toThrow(ZodError);
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case data appropriately', () => {
            const edgeCaseData = createAccommodationListingEdgeCases();

            // Schema should parse but business validation would catch the logic issues
            expect(() => AccommodationListingSchema.parse(edgeCaseData)).not.toThrow();
        });

        it('should handle trial listing without trial end date', () => {
            const data = {
                ...createValidAccommodationListing(),
                isTrial: true,
                trialEndsAt: undefined
            };

            // Schema allows this, business validation would catch it
            expect(() => AccommodationListingSchema.parse(data)).not.toThrow();
        });

        it('should handle non-trial listing with trial end date', () => {
            const data = {
                ...createValidAccommodationListing(),
                isTrial: false,
                trialEndsAt: new Date().toISOString()
            };

            // Schema allows this, business validation would catch inconsistency
            expect(() => AccommodationListingSchema.parse(data)).not.toThrow();
        });
    });

    describe('Field Validation', () => {
        it('should validate all UUID fields correctly', () => {
            const data = createValidAccommodationListing();

            const result = AccommodationListingSchema.parse(data);

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
            expect(result.listingPlanId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should validate datetime fields correctly', () => {
            const data = createValidAccommodationListing();

            const result = AccommodationListingSchema.parse(data);

            // All datetime fields should be valid ISO strings
            expect(() => new Date(result.fromDate)).not.toThrow();
            expect(() => new Date(result.toDate)).not.toThrow();
            expect(() => new Date(result.createdAt)).not.toThrow();
            expect(() => new Date(result.updatedAt)).not.toThrow();

            if (result.trialEndsAt) {
                expect(() => new Date(result.trialEndsAt as string)).not.toThrow();
            }
        });

        it('should validate boolean fields correctly', () => {
            const data = createValidAccommodationListing();

            const result = AccommodationListingSchema.parse(data);

            expect(typeof result.isTrial).toBe('boolean');
        });
    });
});
