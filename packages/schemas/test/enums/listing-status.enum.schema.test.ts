import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { ListingStatusEnum } from '../../src/enums/listing-status.enum';
import { ListingStatusSchema } from '../../src/enums/listing-status.schema';

describe('ListingStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(ListingStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(ListingStatusEnum.PAUSED).toBe('PAUSED');
            expect(ListingStatusEnum.ARCHIVED).toBe('ARCHIVED');
            expect(ListingStatusEnum.TRIAL).toBe('TRIAL');
        });

        it('should have exactly 4 values', () => {
            const values = Object.values(ListingStatusEnum);
            expect(values).toHaveLength(4);
        });

        it('should contain all expected values', () => {
            const values = Object.values(ListingStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining(['ACTIVE', 'PAUSED', 'ARCHIVED', 'TRIAL'])
            );
        });
    });

    describe('ListingStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(ListingStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(ListingStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(ListingStatusSchema.parse('ARCHIVED')).toBe('ARCHIVED');
            expect(ListingStatusSchema.parse('TRIAL')).toBe('TRIAL');
        });

        it('should reject invalid values', () => {
            expect(() => ListingStatusSchema.parse('INVALID')).toThrow();
            expect(() => ListingStatusSchema.parse('')).toThrow();
            expect(() => ListingStatusSchema.parse(null)).toThrow();
            expect(() => ListingStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                ListingStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.listingStatus.invalid');
            }
        });
    });
});
