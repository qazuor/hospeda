import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CommerceEntityTypeEnum } from '../../src/enums/commerce-entity-type.enum.js';
import { CommerceEntityTypeEnumSchema } from '../../src/enums/commerce-entity-type.schema.js';

// ============================================================================
// CommerceEntityTypeEnum — SPEC-239 T-002
// ============================================================================

describe('CommerceEntityTypeEnum', () => {
    describe('enum values', () => {
        it('should define GASTRONOMY', () => {
            expect(CommerceEntityTypeEnum.GASTRONOMY).toBe('gastronomy');
        });

        it('should define EXPERIENCE', () => {
            expect(CommerceEntityTypeEnum.EXPERIENCE).toBe('experience');
        });

        it('should have exactly 2 values', () => {
            expect(Object.values(CommerceEntityTypeEnum)).toHaveLength(2);
        });
    });

    describe('CommerceEntityTypeEnumSchema', () => {
        it('should accept "gastronomy"', () => {
            // Arrange / Act
            const result = CommerceEntityTypeEnumSchema.safeParse('gastronomy');
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "experience"', () => {
            const result = CommerceEntityTypeEnumSchema.safeParse('experience');
            expect(result.success).toBe(true);
        });

        it('should accept all defined values', () => {
            // Arrange
            const values = Object.values(CommerceEntityTypeEnum);
            // Act / Assert
            for (const value of values) {
                expect(CommerceEntityTypeEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown type with ZodError', () => {
            // Arrange / Act
            const result = CommerceEntityTypeEnumSchema.safeParse('accommodation');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject uppercase variant', () => {
            const result = CommerceEntityTypeEnumSchema.safeParse('GASTRONOMY');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = CommerceEntityTypeEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing "experience"', () => {
            // Arrange / Act
            const parsed = CommerceEntityTypeEnumSchema.parse('experience');
            // Assert
            expect(parsed).toBe(CommerceEntityTypeEnum.EXPERIENCE);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => CommerceEntityTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
