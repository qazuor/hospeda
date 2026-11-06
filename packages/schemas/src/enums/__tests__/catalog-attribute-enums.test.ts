import { describe, expect, it } from 'vitest';
import { AmenityAvailabilityEnum } from '../amenity-availability.enum.js';
import { AmenityAvailabilityEnumSchema } from '../amenity-availability.schema.js';
import { AmenityScopeEnum } from '../amenity-scope.enum.js';
import { AmenityScopeEnumSchema } from '../amenity-scope.schema.js';
import { AmenitiesTypeEnum } from '../amenity-type.enum.js';
import { FeatureCategoryEnum } from '../feature-category.enum.js';
import { FeatureCategoryEnumSchema } from '../feature-category.schema.js';

// HOS-2058: the catalog model enums. Value lists are frozen on purpose -- a pgEnum
// cannot lose a value cheaply, so any change here must be a deliberate edit.

describe('FeatureCategoryEnum (HOS-2058)', () => {
    it('holds exactly the 11 owner-approved values, in pgEnum order', () => {
        // Arrange
        const expected = [
            'LOCATION',
            'VIEW',
            'ACCESS',
            'STYLE',
            'AUDIENCE',
            'OFFER_PROFILE',
            'SUSTAINABILITY',
            'ACTIVITIES',
            'CUISINE',
            'DIETARY',
            'LANGUAGE'
        ];

        // Act
        const values = Object.values(FeatureCategoryEnum);

        // Assert
        expect(values).toEqual(expected);
    });

    it('has no SECURITY value (owner decision: those rows are OFFER_PROFILE)', () => {
        expect(Object.values(FeatureCategoryEnum)).not.toContain('SECURITY');
    });

    it('accepts every value and rejects an unknown one with the enum error key', () => {
        for (const value of Object.values(FeatureCategoryEnum)) {
            expect(FeatureCategoryEnumSchema.safeParse(value).success).toBe(true);
        }
        const result = FeatureCategoryEnumSchema.safeParse('SECURITY');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.enums.featureCategory.invalid');
        }
    });
});

describe('AmenityScopeEnum (HOS-2058)', () => {
    it('holds exactly private and shared', () => {
        expect(Object.values(AmenityScopeEnum)).toEqual(['private', 'shared']);
    });

    it('rejects an unknown value with the enum error key', () => {
        const result = AmenityScopeEnumSchema.safeParse('public');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.enums.amenityScope.invalid');
        }
        expect(AmenityScopeEnumSchema.safeParse('private').success).toBe(true);
    });
});

describe('AmenityAvailabilityEnum (HOS-2058)', () => {
    it('holds exactly year_round and seasonal', () => {
        expect(Object.values(AmenityAvailabilityEnum)).toEqual(['year_round', 'seasonal']);
    });

    it('rejects an unknown value with the enum error key', () => {
        const result = AmenityAvailabilityEnumSchema.safeParse('weekends');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.enums.amenityAvailability.invalid'
            );
        }
        expect(AmenityAvailabilityEnumSchema.safeParse('seasonal').success).toBe(true);
    });
});

describe('AmenitiesTypeEnum (HOS-2058 additions)', () => {
    it('appends the five new categories after the original twelve', () => {
        // Arrange: Postgres appends enum values, and the enum-consistency test
        // compares order, so the new values must sit at the end.
        const values = Object.values(AmenitiesTypeEnum);

        // Assert
        expect(values).toHaveLength(17);
        expect(values.slice(12)).toEqual([
            'PARKING',
            'LAUNDRY',
            'WATER_ACTIVITIES',
            'WELLNESS',
            'DINING'
        ]);
        expect(values[11]).toBe('GENERAL_APPLIANCES');
    });
});
