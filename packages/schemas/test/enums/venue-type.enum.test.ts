import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { VenueTypeEnum } from '../../src/enums/venue-type.enum.js';
import { VenueTypeEnumSchema } from '../../src/enums/venue-type.schema.js';

// ============================================================================
// GastronomyTypeEnum — SPEC-239 T-003
// 9 values: RESTAURANT, BAR, CAFE, PARRILLA, CERVECERIA, HELADERIA, PANADERIA,
//           ROTISERIA, FOOD_TRUCK
// ============================================================================

describe('GastronomyTypeEnum', () => {
    describe('enum values', () => {
        it('should define RESTAURANT', () => {
            expect(VenueTypeEnum.RESTAURANT).toBe('RESTAURANT');
        });

        it('should define BAR', () => {
            expect(VenueTypeEnum.BAR).toBe('BAR');
        });

        it('should define CAFE', () => {
            expect(VenueTypeEnum.CAFE).toBe('CAFE');
        });

        it('should define PARRILLA', () => {
            expect(VenueTypeEnum.PARRILLA).toBe('PARRILLA');
        });

        it('should define CERVECERIA', () => {
            expect(VenueTypeEnum.CERVECERIA).toBe('CERVECERIA');
        });

        it('should define HELADERIA', () => {
            expect(VenueTypeEnum.HELADERIA).toBe('HELADERIA');
        });

        it('should define PANADERIA', () => {
            expect(VenueTypeEnum.PANADERIA).toBe('PANADERIA');
        });

        it('should define ROTISERIA', () => {
            expect(VenueTypeEnum.ROTISERIA).toBe('ROTISERIA');
        });

        it('should define FOOD_TRUCK', () => {
            expect(VenueTypeEnum.FOOD_TRUCK).toBe('FOOD_TRUCK');
        });

        it('should have exactly 9 values', () => {
            expect(Object.values(VenueTypeEnum)).toHaveLength(9);
        });
    });

    describe('GastronomyTypeEnumSchema', () => {
        it('should accept all 9 defined values', () => {
            // Arrange
            const values = Object.values(VenueTypeEnum);
            // Act / Assert
            for (const value of values) {
                expect(VenueTypeEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should accept RESTAURANT', () => {
            expect(VenueTypeEnumSchema.safeParse('RESTAURANT').success).toBe(true);
        });

        it('should accept FOOD_TRUCK', () => {
            expect(VenueTypeEnumSchema.safeParse('FOOD_TRUCK').success).toBe(true);
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = VenueTypeEnumSchema.safeParse('PIZZA_PLACE');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = VenueTypeEnumSchema.safeParse('restaurant');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = VenueTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = VenueTypeEnumSchema.parse('PARRILLA');
            // Assert
            expect(parsed).toBe(VenueTypeEnum.PARRILLA);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => VenueTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
