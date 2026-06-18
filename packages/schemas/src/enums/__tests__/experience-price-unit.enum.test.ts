import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExperiencePriceUnitEnum } from '../experience-price-unit.enum.js';
import { ExperiencePriceUnitEnumSchema } from '../experience-price-unit.schema.js';

// ============================================================================
// ExperiencePriceUnitEnum — SPEC-240 (4 price-unit values; lowercase values)
// ============================================================================

describe('ExperiencePriceUnitEnum', () => {
    it('should have exactly 4 values', () => {
        // Arrange
        const values = Object.values(ExperiencePriceUnitEnum);

        // Assert
        expect(values).toHaveLength(4);
    });

    describe('value strings are lowercase (DB-compatible)', () => {
        it('PER_DAY should map to "per_day" (lowercase)', () => {
            expect(ExperiencePriceUnitEnum.PER_DAY).toBe('per_day');
        });

        it('PER_HOUR should map to "per_hour" (lowercase)', () => {
            expect(ExperiencePriceUnitEnum.PER_HOUR).toBe('per_hour');
        });

        it('PER_PERSON should map to "per_person" (lowercase)', () => {
            expect(ExperiencePriceUnitEnum.PER_PERSON).toBe('per_person');
        });

        it('PER_GROUP should map to "per_group" (lowercase)', () => {
            expect(ExperiencePriceUnitEnum.PER_GROUP).toBe('per_group');
        });
    });

    describe('ExperiencePriceUnitEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(ExperiencePriceUnitEnum)) {
                const result = ExperiencePriceUnitEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should accept "per_day"', () => {
            const result = ExperiencePriceUnitEnumSchema.safeParse('per_day');
            expect(result.success).toBe(true);
        });

        it('should accept "per_hour"', () => {
            const result = ExperiencePriceUnitEnumSchema.safeParse('per_hour');
            expect(result.success).toBe(true);
        });

        it('should accept "per_person"', () => {
            const result = ExperiencePriceUnitEnumSchema.safeParse('per_person');
            expect(result.success).toBe(true);
        });

        it('should accept "per_group"', () => {
            const result = ExperiencePriceUnitEnumSchema.safeParse('per_group');
            expect(result.success).toBe(true);
        });

        it('should reject uppercase variants (e.g. "PER_DAY")', () => {
            // Values are lowercase; uppercase is NOT a valid enum value
            const result = ExperiencePriceUnitEnumSchema.safeParse('PER_DAY');
            expect(result.success).toBe(false);
        });

        it('should reject an unknown unit with ZodError', () => {
            // Arrange / Act
            const result = ExperiencePriceUnitEnumSchema.safeParse('per_week');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject empty string', () => {
            const result = ExperiencePriceUnitEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = ExperiencePriceUnitEnumSchema.parse('per_person');

            // Assert
            expect(parsed).toBe(ExperiencePriceUnitEnum.PER_PERSON);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => ExperiencePriceUnitEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });

    describe('DB parity: enum values match the expected PG enum strings', () => {
        it('value array should equal the expected DB strings', () => {
            // Arrange — the PG enum on the DB side uses these exact strings
            const expectedDbValues = ['per_day', 'per_hour', 'per_person', 'per_group'];

            // Act
            const actualValues = Object.values(ExperiencePriceUnitEnum);

            // Assert
            expect(actualValues).toEqual(expectedDbValues);
        });
    });
});
