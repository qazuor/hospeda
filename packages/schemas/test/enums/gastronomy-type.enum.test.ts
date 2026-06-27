import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { GastronomyTypeEnum } from '../../src/enums/gastronomy-type.enum.js';
import { GastronomyTypeEnumSchema } from '../../src/enums/gastronomy-type.schema.js';

// ============================================================================
// GastronomyTypeEnum — SPEC-239 T-003
// 9 values: RESTAURANT, BAR, CAFE, PARRILLA, CERVECERIA, HELADERIA, PANADERIA,
//           ROTISERIA, FOOD_TRUCK
// ============================================================================

describe('GastronomyTypeEnum', () => {
    describe('enum values', () => {
        it('should define RESTAURANT', () => {
            expect(GastronomyTypeEnum.RESTAURANT).toBe('RESTAURANT');
        });

        it('should define BAR', () => {
            expect(GastronomyTypeEnum.BAR).toBe('BAR');
        });

        it('should define CAFE', () => {
            expect(GastronomyTypeEnum.CAFE).toBe('CAFE');
        });

        it('should define PARRILLA', () => {
            expect(GastronomyTypeEnum.PARRILLA).toBe('PARRILLA');
        });

        it('should define CERVECERIA', () => {
            expect(GastronomyTypeEnum.CERVECERIA).toBe('CERVECERIA');
        });

        it('should define HELADERIA', () => {
            expect(GastronomyTypeEnum.HELADERIA).toBe('HELADERIA');
        });

        it('should define PANADERIA', () => {
            expect(GastronomyTypeEnum.PANADERIA).toBe('PANADERIA');
        });

        it('should define ROTISERIA', () => {
            expect(GastronomyTypeEnum.ROTISERIA).toBe('ROTISERIA');
        });

        it('should define FOOD_TRUCK', () => {
            expect(GastronomyTypeEnum.FOOD_TRUCK).toBe('FOOD_TRUCK');
        });

        it('should have exactly 9 values', () => {
            expect(Object.values(GastronomyTypeEnum)).toHaveLength(9);
        });
    });

    describe('GastronomyTypeEnumSchema', () => {
        it('should accept all 9 defined values', () => {
            // Arrange
            const values = Object.values(GastronomyTypeEnum);
            // Act / Assert
            for (const value of values) {
                expect(GastronomyTypeEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should accept RESTAURANT', () => {
            expect(GastronomyTypeEnumSchema.safeParse('RESTAURANT').success).toBe(true);
        });

        it('should accept FOOD_TRUCK', () => {
            expect(GastronomyTypeEnumSchema.safeParse('FOOD_TRUCK').success).toBe(true);
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = GastronomyTypeEnumSchema.safeParse('PIZZA_PLACE');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = GastronomyTypeEnumSchema.safeParse('restaurant');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = GastronomyTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = GastronomyTypeEnumSchema.parse('PARRILLA');
            // Assert
            expect(parsed).toBe(GastronomyTypeEnum.PARRILLA);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => GastronomyTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
