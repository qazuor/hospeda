import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CommerceRatingSchema } from '../../src/common/commerce-rating.schema.js';

// ============================================================================
// CommerceRatingSchema — SPEC-239 T-005
// ============================================================================

describe('CommerceRatingSchema', () => {
    describe('valid inputs', () => {
        it('should parse a valid rating breakdown with all four fields', () => {
            // Arrange
            const input = { food: 4.5, service: 5, ambiance: 4, value: 3.5 };
            // Act
            const result = CommerceRatingSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept boundary value 0 for all fields', () => {
            // Arrange
            const input = { food: 0, service: 0, ambiance: 0, value: 0 };
            // Act
            const result = CommerceRatingSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept boundary value 5 for all fields', () => {
            // Arrange
            const input = { food: 5, service: 5, ambiance: 5, value: 5 };
            // Act
            const result = CommerceRatingSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept 0 for food', () => {
            const result = CommerceRatingSchema.safeParse({
                food: 0,
                service: 3,
                ambiance: 3,
                value: 3
            });
            expect(result.success).toBe(true);
        });

        it('should accept 5 for service', () => {
            const result = CommerceRatingSchema.safeParse({
                food: 3,
                service: 5,
                ambiance: 3,
                value: 3
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid inputs — out-of-range values', () => {
        it('should reject food score above 5', () => {
            // Arrange
            const input = { food: 6, service: 4, ambiance: 4, value: 4 };
            // Act
            const result = CommerceRatingSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject service score below 0 (negative)', () => {
            // Arrange
            const input = { food: 4, service: -1, ambiance: 4, value: 4 };
            // Act
            const result = CommerceRatingSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject ambiance score above 5', () => {
            const result = CommerceRatingSchema.safeParse({
                food: 4,
                service: 4,
                ambiance: 5.1,
                value: 4
            });
            expect(result.success).toBe(false);
        });

        it('should reject value score below 0', () => {
            const result = CommerceRatingSchema.safeParse({
                food: 4,
                service: 4,
                ambiance: 4,
                value: -0.1
            });
            expect(result.success).toBe(false);
        });
    });

    describe('invalid inputs — missing fields', () => {
        it('should reject missing food field', () => {
            const result = CommerceRatingSchema.safeParse({
                service: 4,
                ambiance: 4,
                value: 4
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing service field', () => {
            const result = CommerceRatingSchema.safeParse({
                food: 4,
                ambiance: 4,
                value: 4
            });
            expect(result.success).toBe(false);
        });

        it('should reject empty object', () => {
            const result = CommerceRatingSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});
