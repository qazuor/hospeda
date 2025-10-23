import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { AdSlotReservationStatusEnum } from '../../src/enums/ad-slot-reservation-status.enum';
import { AdSlotReservationStatusSchema } from '../../src/enums/ad-slot-reservation-status.schema';

describe('AdSlotReservationStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(AdSlotReservationStatusEnum.RESERVED).toBe('RESERVED');
            expect(AdSlotReservationStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(AdSlotReservationStatusEnum.PAUSED).toBe('PAUSED');
            expect(AdSlotReservationStatusEnum.ENDED).toBe('ENDED');
            expect(AdSlotReservationStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should have exactly 5 values', () => {
            const values = Object.values(AdSlotReservationStatusEnum);
            expect(values).toHaveLength(5);
        });

        it('should contain all expected values', () => {
            const values = Object.values(AdSlotReservationStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining(['RESERVED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED'])
            );
        });
    });

    describe('AdSlotReservationStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(AdSlotReservationStatusSchema.parse('RESERVED')).toBe('RESERVED');
            expect(AdSlotReservationStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(AdSlotReservationStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(AdSlotReservationStatusSchema.parse('ENDED')).toBe('ENDED');
            expect(AdSlotReservationStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });

        it('should reject invalid values', () => {
            expect(() => AdSlotReservationStatusSchema.parse('INVALID')).toThrow();
            expect(() => AdSlotReservationStatusSchema.parse('')).toThrow();
            expect(() => AdSlotReservationStatusSchema.parse(null)).toThrow();
            expect(() => AdSlotReservationStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                AdSlotReservationStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe(
                    'zodError.enums.adSlotReservationStatus.invalid'
                );
            }
        });
    });
});
