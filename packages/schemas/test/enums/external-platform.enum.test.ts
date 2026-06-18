import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExternalPlatformEnum } from '../../src/enums/external-platform.enum.js';
import { ExternalPlatformEnumSchema } from '../../src/enums/external-platform.schema.js';

// ============================================================================
// ExternalPlatformEnum — SPEC-237 T-001
// ============================================================================

describe('ExternalPlatformEnum', () => {
    describe('enum values', () => {
        it('should define GOOGLE', () => {
            expect(ExternalPlatformEnum.GOOGLE).toBe('GOOGLE');
        });

        it('should define BOOKING', () => {
            expect(ExternalPlatformEnum.BOOKING).toBe('BOOKING');
        });

        it('should define AIRBNB', () => {
            expect(ExternalPlatformEnum.AIRBNB).toBe('AIRBNB');
        });

        it('should define OTHER', () => {
            expect(ExternalPlatformEnum.OTHER).toBe('OTHER');
        });

        it('should have exactly 4 values', () => {
            expect(Object.values(ExternalPlatformEnum)).toHaveLength(4);
        });
    });

    describe('ExternalPlatformEnumSchema', () => {
        it('should accept "GOOGLE"', () => {
            // Arrange / Act
            const result = ExternalPlatformEnumSchema.safeParse('GOOGLE');
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "BOOKING"', () => {
            const result = ExternalPlatformEnumSchema.safeParse('BOOKING');
            expect(result.success).toBe(true);
        });

        it('should accept "AIRBNB"', () => {
            const result = ExternalPlatformEnumSchema.safeParse('AIRBNB');
            expect(result.success).toBe(true);
        });

        it('should accept "OTHER"', () => {
            const result = ExternalPlatformEnumSchema.safeParse('OTHER');
            expect(result.success).toBe(true);
        });

        it('should accept all defined enum values', () => {
            // Arrange
            const values = Object.values(ExternalPlatformEnum);
            // Act / Assert
            for (const value of values) {
                expect(ExternalPlatformEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown platform with ZodError', () => {
            // Arrange / Act
            const result = ExternalPlatformEnumSchema.safeParse('TRIPADVISOR');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variant', () => {
            const result = ExternalPlatformEnumSchema.safeParse('google');
            expect(result.success).toBe(false);
        });

        it('should reject empty string', () => {
            const result = ExternalPlatformEnumSchema.safeParse('');
            expect(result.success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = ExternalPlatformEnumSchema.parse('AIRBNB');
            // Assert
            expect(parsed).toBe(ExternalPlatformEnum.AIRBNB);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => ExternalPlatformEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
