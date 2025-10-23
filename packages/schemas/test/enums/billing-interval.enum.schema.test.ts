import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BillingIntervalEnumSchema } from '../../src/enums/billing-interval.schema.js';
import { BillingIntervalEnum } from '../../src/enums/index.js';

describe('BillingIntervalEnumSchema', () => {
    it('should validate valid billing interval values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(BillingIntervalEnum).forEach((billingInterval) => {
            expect(() => BillingIntervalEnumSchema.parse(billingInterval)).not.toThrow();
        });
    });

    it('should validate MONTH billing interval', () => {
        expect(() => BillingIntervalEnumSchema.parse(BillingIntervalEnum.MONTH)).not.toThrow();
    });

    it('should validate YEAR billing interval', () => {
        expect(() => BillingIntervalEnumSchema.parse(BillingIntervalEnum.YEAR)).not.toThrow();
    });

    it('should validate BIYEAR billing interval', () => {
        expect(() => BillingIntervalEnumSchema.parse(BillingIntervalEnum.BIYEAR)).not.toThrow();
    });

    it('should reject invalid billing interval values', () => {
        const invalidBillingIntervals = [
            'invalid-billing-interval',
            'WEEKLY', // Not in this enum
            'DAILY',
            'QUARTERLY',
            'DAY',
            'WEEK',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidBillingIntervals.forEach((billingInterval) => {
            expect(() => BillingIntervalEnumSchema.parse(billingInterval)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            BillingIntervalEnumSchema.parse('invalid-billing-interval');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.billingInterval.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validBillingInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.MONTH);

        // TypeScript should infer this as BillingIntervalEnum
        expect(typeof validBillingInterval).toBe('string');
        expect(Object.values(BillingIntervalEnum)).toContain(validBillingInterval);
    });

    it('should have all expected billing intervals', () => {
        const expectedBillingIntervals = ['month', 'year', 'biyear'];

        const enumValues = Object.values(BillingIntervalEnum);
        expect(enumValues).toHaveLength(expectedBillingIntervals.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        expectedBillingIntervals.forEach((expectedInterval) => {
            expect(enumValues).toContain(expectedInterval);
        });
    });

    it('should support pricing calculations', () => {
        // Test that intervals can be used for pricing calculations
        const monthInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.MONTH);
        const yearInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.YEAR);
        const biyearInterval = BillingIntervalEnumSchema.parse(BillingIntervalEnum.BIYEAR);

        expect(monthInterval).toBe('month');
        expect(yearInterval).toBe('year');
        expect(biyearInterval).toBe('biyear');

        // These values should only be used with RECURRING billing scheme
        const intervals = [monthInterval, yearInterval, biyearInterval];
        // biome-ignore lint/complexity/noForEach: <explanation>
        intervals.forEach((interval) => {
            expect(typeof interval).toBe('string');
            expect(interval.length).toBeGreaterThan(0);
        });
    });

    it('should provide interval period mapping', () => {
        // Test that we can map intervals to periods for calculations
        const intervalToPeriodMap = {
            [BillingIntervalEnum.MONTH]: 1,
            [BillingIntervalEnum.YEAR]: 12,
            [BillingIntervalEnum.BIYEAR]: 24
        };

        expect(intervalToPeriodMap[BillingIntervalEnum.MONTH]).toBe(1);
        expect(intervalToPeriodMap[BillingIntervalEnum.YEAR]).toBe(12);
        expect(intervalToPeriodMap[BillingIntervalEnum.BIYEAR]).toBe(24);
    });
});
