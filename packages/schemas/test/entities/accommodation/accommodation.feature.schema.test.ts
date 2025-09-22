import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationFeatureSchema,
    FeatureSchema
} from '../../../src/entities/accommodation/subtypes/accommodation.feature.schema';
import { FeatureSchema as MainFeatureSchema } from '../../../src/entities/feature/feature.schema';

/**
 * Tests for accommodation feature schema imports and re-exports
 * Ensures that the re-exported FeatureSchema is the same as the main one
 */
describe('AccommodationFeatureSchema Imports', () => {
    it('should re-export the same FeatureSchema as the main feature entity', () => {
        // Both schemas should be the same object reference
        expect(FeatureSchema).toBe(MainFeatureSchema);
    });

    it('should validate accommodation feature association', () => {
        const validAssociation = {
            accommodationId: '12345678-1234-4234-8234-123456789012',
            featureId: '12345678-1234-4234-8234-123456789013',
            notes: 'Free WiFi throughout property',
            isHighlighted: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            createdBy: '12345678-1234-4234-8234-123456789014',
            updatedBy: '12345678-1234-4234-8234-123456789014',
            createdById: '12345678-1234-4234-8234-123456789014',
            updatedById: '12345678-1234-4234-8234-123456789014'
        };

        expect(() => AccommodationFeatureSchema.parse(validAssociation)).not.toThrow();

        const result = AccommodationFeatureSchema.parse(validAssociation);
        expect(result.accommodationId).toBe(validAssociation.accommodationId);
        expect(result.featureId).toBe(validAssociation.featureId);
        expect(result.notes).toBe('Free WiFi throughout property');
        expect(result.isHighlighted).toBe(true);
    });

    it('should validate minimal accommodation feature association', () => {
        const minimalAssociation = {
            accommodationId: '12345678-1234-4234-8234-123456789012',
            featureId: '12345678-1234-4234-8234-123456789013',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            createdBy: '12345678-1234-4234-8234-123456789014',
            updatedBy: '12345678-1234-4234-8234-123456789014',
            createdById: '12345678-1234-4234-8234-123456789014',
            updatedById: '12345678-1234-4234-8234-123456789014'
        };

        expect(() => AccommodationFeatureSchema.parse(minimalAssociation)).not.toThrow();

        const result = AccommodationFeatureSchema.parse(minimalAssociation);
        expect(result.accommodationId).toBe(minimalAssociation.accommodationId);
        expect(result.featureId).toBe(minimalAssociation.featureId);
        expect(result.notes).toBeUndefined(); // Optional field
        expect(result.isHighlighted).toBe(false); // Default value
    });

    it('should reject invalid accommodation feature association', () => {
        const invalidAssociation = {
            accommodationId: 'invalid-id',
            featureId: 'fea_12345678-1234-1234-1234-123456789012'
            // Missing required audit fields
        };

        expect(() => AccommodationFeatureSchema.parse(invalidAssociation)).toThrow(ZodError);
    });
});
