import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationAmenitySchema,
    AmenitySchema
} from '../../../src/entities/accommodation/subtypes/accommodation.amenity.schema';
import { AmenitySchema as MainAmenitySchema } from '../../../src/entities/amenity/amenity.schema';

/**
 * Test suite for AccommodationAmenitySchema re-exports and accommodation amenity association
 */
describe('AccommodationAmenitySchema Imports', () => {
    it('should re-export the same AmenitySchema as the main amenity entity', () => {
        // Verify that re-exported schema is the same as the main schema
        expect(AmenitySchema).toBe(MainAmenitySchema);
        expect(AmenitySchema._def).toEqual(MainAmenitySchema._def);
    });

    it('should validate accommodation amenity association', () => {
        const validAssociation = {
            accommodationId: '12345678-1234-4234-8234-123456789012',
            amenityId: '12345678-1234-4234-8234-123456789013',
            isIncluded: false,
            price: {
                amount: 25.5,
                currency: 'USD'
            },
            notes: 'Available 24/7',
            isHighlighted: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            createdBy: '12345678-1234-4234-8234-123456789014',
            updatedBy: '12345678-1234-4234-8234-123456789014',
            createdById: '12345678-1234-4234-8234-123456789014',
            updatedById: '12345678-1234-4234-8234-123456789014'
        };

        expect(() => AccommodationAmenitySchema.parse(validAssociation)).not.toThrow();

        const result = AccommodationAmenitySchema.parse(validAssociation);
        expect(result.accommodationId).toBe(validAssociation.accommodationId);
        expect(result.amenityId).toBe(validAssociation.amenityId);
        expect(result.isIncluded).toBe(false);
        expect(result.isHighlighted).toBe(true);
    });

    it('should validate minimal accommodation amenity association', () => {
        const minimalAssociation = {
            accommodationId: '12345678-1234-4234-8234-123456789012',
            amenityId: '12345678-1234-4234-8234-123456789013',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            createdBy: '12345678-1234-4234-8234-123456789014',
            updatedBy: '12345678-1234-4234-8234-123456789014',
            createdById: '12345678-1234-4234-8234-123456789014',
            updatedById: '12345678-1234-4234-8234-123456789014'
        };

        expect(() => AccommodationAmenitySchema.parse(minimalAssociation)).not.toThrow();

        const result = AccommodationAmenitySchema.parse(minimalAssociation);
        expect(result.isIncluded).toBe(true); // Default value
        expect(result.isHighlighted).toBe(false); // Default value
    });

    it('should reject invalid accommodation amenity association', () => {
        const invalidAssociation = {
            accommodationId: 'invalid-id',
            amenityId: '12345678-1234-4234-8234-123456789013'
            // Missing required audit fields
        };

        expect(() => AccommodationAmenitySchema.parse(invalidAssociation)).toThrow(ZodError);
    });
});
