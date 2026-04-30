import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { TagTypeEnum } from '../tag-type.enum.js';
import { TagTypeSchema } from '../tag-type.schema.js';

// ============================================================================
// TagTypeEnum
// ============================================================================

describe('TagTypeEnum', () => {
    it('should have exactly 3 values', () => {
        // Arrange
        const values = Object.values(TagTypeEnum);

        // Assert
        expect(values).toHaveLength(3);
    });

    it('should include INTERNAL, SYSTEM, and USER', () => {
        expect(TagTypeEnum.INTERNAL).toBe('INTERNAL');
        expect(TagTypeEnum.SYSTEM).toBe('SYSTEM');
        expect(TagTypeEnum.USER).toBe('USER');
    });

    describe('TagTypeSchema', () => {
        it('should accept INTERNAL as a valid value', () => {
            // Arrange / Act
            const result = TagTypeSchema.safeParse('INTERNAL');

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept SYSTEM as a valid value', () => {
            const result = TagTypeSchema.safeParse('SYSTEM');
            expect(result.success).toBe(true);
        });

        it('should accept USER as a valid value', () => {
            const result = TagTypeSchema.safeParse('USER');
            expect(result.success).toBe(true);
        });

        it('should accept all TagTypeEnum values', () => {
            for (const value of Object.values(TagTypeEnum)) {
                const result = TagTypeSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an invalid value with ZodError', () => {
            // Arrange / Act
            const result = TagTypeSchema.safeParse('INVALID');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject SCOPE (removed dimension from design)', () => {
            const result = TagTypeSchema.safeParse('SCOPE');
            expect(result.success).toBe(false);
        });

        it('should reject lowercase variants', () => {
            const result = TagTypeSchema.safeParse('internal');
            expect(result.success).toBe(false);
        });

        it('should return the custom error message for invalid values', () => {
            const result = TagTypeSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe('zodError.enums.tagType.invalid');
            }
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = TagTypeSchema.parse('INTERNAL');

            // Assert
            expect(parsed).toBe(TagTypeEnum.INTERNAL);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            // Act / Assert
            expect(() => TagTypeSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});
