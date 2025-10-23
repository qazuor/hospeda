import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { SponsorshipStatusEnum } from '../../src/enums/sponsorship-status.enum';
import { SponsorshipStatusSchema } from '../../src/enums/sponsorship-status.schema';

describe('SponsorshipStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(SponsorshipStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(SponsorshipStatusEnum.PAUSED).toBe('PAUSED');
            expect(SponsorshipStatusEnum.EXPIRED).toBe('EXPIRED');
            expect(SponsorshipStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should have exactly 4 values', () => {
            const values = Object.values(SponsorshipStatusEnum);
            expect(values).toHaveLength(4);
        });

        it('should contain all expected values', () => {
            const values = Object.values(SponsorshipStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining(['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'])
            );
        });
    });

    describe('SponsorshipStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(SponsorshipStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(SponsorshipStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(SponsorshipStatusSchema.parse('EXPIRED')).toBe('EXPIRED');
            expect(SponsorshipStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });

        it('should reject invalid values', () => {
            expect(() => SponsorshipStatusSchema.parse('INVALID')).toThrow();
            expect(() => SponsorshipStatusSchema.parse('')).toThrow();
            expect(() => SponsorshipStatusSchema.parse(null)).toThrow();
            expect(() => SponsorshipStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                SponsorshipStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe(
                    'zodError.enums.sponsorshipStatus.invalid'
                );
            }
        });
    });
});
