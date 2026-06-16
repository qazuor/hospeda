import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PriceRangeEnum } from '../../src/enums/price-range.enum.js';
import { PriceRangeEnumSchema } from '../../src/enums/price-range.schema.js';

// ============================================================================
// PriceRangeEnum — SPEC-239 T-001
// ============================================================================

describe('PriceRangeEnum', () => {
    describe('enum values', () => {
        it('should define BUDGET', () => {
            expect(PriceRangeEnum.BUDGET).toBe('BUDGET');
        });

        it('should define MID', () => {
            expect(PriceRangeEnum.MID).toBe('MID');
        });

        it('should define HIGH', () => {
            expect(PriceRangeEnum.HIGH).toBe('HIGH');
        });

        it('should define PREMIUM', () => {
            expect(PriceRangeEnum.PREMIUM).toBe('PREMIUM');
        });

        it('should have exactly 4 values', () => {
            expect(Object.values(PriceRangeEnum)).toHaveLength(4);
        });
    });

    describe('PriceRangeEnumSchema', () => {
        it('should accept BUDGET', () => {
            // Arrange / Act
            const result = PriceRangeEnumSchema.safeParse('BUDGET');
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept MID', () => {
            const result = PriceRangeEnumSchema.safeParse('MID');
            expect(result.success).toBe(true);
        });

        it('should accept HIGH', () => {
            const result = PriceRangeEnumSchema.safeParse('HIGH');
            expect(result.success).toBe(true);
        });

        it('should accept PREMIUM', () => {
            const result = PriceRangeEnumSchema.safeParse('PREMIUM');
            expect(result.success).toBe(true);
        });

        it('should accept all defined values', () => {
            // Arrange
            const values = Object.values(PriceRangeEnum);
            // Act / Assert
            for (const value of values) {
                expect(PriceRangeEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown value with ZodError', () => {
            // Arrange / Act
            const result = PriceRangeEnumSchema.safeParse('LUXURY');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = PriceRangeEnumSchema.safeParse('budget');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = PriceRangeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = PriceRangeEnumSchema.parse('PREMIUM');
            // Assert
            expect(parsed).toBe(PriceRangeEnum.PREMIUM);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => PriceRangeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
