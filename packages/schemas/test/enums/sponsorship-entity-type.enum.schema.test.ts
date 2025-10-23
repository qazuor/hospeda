import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { SponsorshipEntityTypeEnum } from '../../src/enums/sponsorship-entity-type.enum';
import { SponsorshipEntityTypeSchema } from '../../src/enums/sponsorship-entity-type.schema';

describe('SponsorshipEntityTypeEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(SponsorshipEntityTypeEnum.POST).toBe('POST');
            expect(SponsorshipEntityTypeEnum.EVENT).toBe('EVENT');
        });

        it('should have exactly 2 values', () => {
            const values = Object.values(SponsorshipEntityTypeEnum);
            expect(values).toHaveLength(2);
        });

        it('should contain all expected values', () => {
            const values = Object.values(SponsorshipEntityTypeEnum);
            expect(values).toEqual(expect.arrayContaining(['POST', 'EVENT']));
        });
    });

    describe('SponsorshipEntityTypeSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(SponsorshipEntityTypeSchema.parse('POST')).toBe('POST');
            expect(SponsorshipEntityTypeSchema.parse('EVENT')).toBe('EVENT');
        });

        it('should reject invalid values', () => {
            expect(() => SponsorshipEntityTypeSchema.parse('INVALID')).toThrow();
            expect(() => SponsorshipEntityTypeSchema.parse('')).toThrow();
            expect(() => SponsorshipEntityTypeSchema.parse(null)).toThrow();
            expect(() => SponsorshipEntityTypeSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                SponsorshipEntityTypeSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe(
                    'zodError.enums.sponsorshipEntityType.invalid'
                );
            }
        });
    });
});
