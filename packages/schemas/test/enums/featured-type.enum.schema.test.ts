import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { FeaturedTypeEnum } from '../../src/enums/featured-type.enum';
import { FeaturedTypeSchema } from '../../src/enums/featured-type.schema';

describe('FeaturedTypeEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(FeaturedTypeEnum.HOME).toBe('HOME');
            expect(FeaturedTypeEnum.DESTINATION).toBe('DESTINATION');
            expect(FeaturedTypeEnum.SEARCH).toBe('SEARCH');
            expect(FeaturedTypeEnum.OTHER).toBe('OTHER');
        });

        it('should have exactly 4 values', () => {
            const values = Object.values(FeaturedTypeEnum);
            expect(values).toHaveLength(4);
        });

        it('should contain all expected values', () => {
            const values = Object.values(FeaturedTypeEnum);
            expect(values).toEqual(
                expect.arrayContaining(['HOME', 'DESTINATION', 'SEARCH', 'OTHER'])
            );
        });
    });

    describe('FeaturedTypeSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(FeaturedTypeSchema.parse('HOME')).toBe('HOME');
            expect(FeaturedTypeSchema.parse('DESTINATION')).toBe('DESTINATION');
            expect(FeaturedTypeSchema.parse('SEARCH')).toBe('SEARCH');
            expect(FeaturedTypeSchema.parse('OTHER')).toBe('OTHER');
        });

        it('should reject invalid values', () => {
            expect(() => FeaturedTypeSchema.parse('INVALID')).toThrow();
            expect(() => FeaturedTypeSchema.parse('')).toThrow();
            expect(() => FeaturedTypeSchema.parse(null)).toThrow();
            expect(() => FeaturedTypeSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                FeaturedTypeSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.featuredType.invalid');
            }
        });
    });
});
