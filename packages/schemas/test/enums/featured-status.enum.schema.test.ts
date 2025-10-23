import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { FeaturedStatusEnum } from '../../src/enums/featured-status.enum';
import { FeaturedStatusSchema } from '../../src/enums/featured-status.schema';

describe('FeaturedStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(FeaturedStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(FeaturedStatusEnum.PAUSED).toBe('PAUSED');
            expect(FeaturedStatusEnum.EXPIRED).toBe('EXPIRED');
            expect(FeaturedStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should have exactly 4 values', () => {
            const values = Object.values(FeaturedStatusEnum);
            expect(values).toHaveLength(4);
        });

        it('should contain all expected values', () => {
            const values = Object.values(FeaturedStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining(['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'])
            );
        });
    });

    describe('FeaturedStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(FeaturedStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(FeaturedStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(FeaturedStatusSchema.parse('EXPIRED')).toBe('EXPIRED');
            expect(FeaturedStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });

        it('should reject invalid values', () => {
            expect(() => FeaturedStatusSchema.parse('INVALID')).toThrow();
            expect(() => FeaturedStatusSchema.parse('')).toThrow();
            expect(() => FeaturedStatusSchema.parse(null)).toThrow();
            expect(() => FeaturedStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                FeaturedStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.featuredStatus.invalid');
            }
        });
    });
});
